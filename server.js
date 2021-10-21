const Ban = require('./ban');
const BotCommands = require('./bot-commands');
const Clock = require('./clock');
const DB = require('./database');
const deepEqual = require('deep-equal');
const DiscordUtil = require('./discord-util');
const HarmonicCentrality = require('./harmonic-centrality');
const huddles = require('./huddles');
const moment = require('moment');
const Rank = require('./rank');
const RankMetadata = require('./rank-definitions');
const RateLimit = require('./rate-limit');
const RoleID = require('./role-id');
const TimeTogetherStream = require('./time-together-stream');
const UserCache = require('./user-cache');

// Used for streaming time matrix data to the database.
const timeTogetherStream = new TimeTogetherStream(new Clock());

// Updates a guild member's color.
async function UpdateMemberRankRoles(member, rankData, goodStanding) {
    let rolesToAdd = rankData.roles;
    let rolesToRemove = [];
    for (const rank of RankMetadata) {
	for (const role of rank.roles) {
	    if (!rolesToAdd.includes(role)) {
		rolesToRemove.push(role);
	    }
	}
    }
    if (!goodStanding) {
	rolesToRemove = rolesToRemove.concat(rolesToAdd);
	rolesToAdd = [];
    }
    for (const role of rolesToAdd) {
	await DiscordUtil.AddRole(member, role);
    }
    for (const role of rolesToRemove) {
	await DiscordUtil.RemoveRole(member, role);
    }
}

// Update the rank insignia, nickname, and roles of a Discord guild
// member based on the latest info stored in the user cache.
async function UpdateMemberAppearance(member) {
    if (member.user.bot) {
	// Ignore other bots.
	return;
    }
    const cu = await UserCache.GetCachedUserByDiscordId(member.user.id);
    if (!cu) {
	console.log('Unknown user detected! username:', member.user.username);
	return;
    }
    if (!cu.citizen) {
	return;
    }
    if (!cu.rank && cu.rank !== 0) {
	// The user has not been assigned a rank yet. Bail.
	return;
    }
    const rankData = RankMetadata[cu.rank];
    if (!rankData) {
	throw 'Invalid rank detected. This can indicate serious problems.';
    }
    const displayName = cu.getNicknameOrTitleWithInsignia();
    if (member.nickname !== displayName && member.user.id !== member.guild.ownerID) {
	console.log(`Updating nickname ${displayName}.`);
	member.setNickname(displayName);
    }
    // Update role (including rank color).
    UpdateMemberRankRoles(member, rankData, cu.good_standing);
    if (rankData.banPower) {
	await DiscordUtil.AddRole(member, RoleID.BanPower);
    } else {
	await DiscordUtil.RemoveRole(member, RoleID.BanPower);
    }
}

// Updates people's rank and nickname-based insignia (dots, stars) in Discord.
async function UpdateAllDiscordMemberAppearances() {
    const guild = await DiscordUtil.GetMainDiscordGuild();
    console.log('Fetching members to update appearances.');
    const members = await guild.members.fetch();
    console.log('Got members. Updating appearances.');
    for (const [memberId, member] of members) {
	await UpdateMemberAppearance(member);
    }
}

// Looks for 2 or more users in voice channels together and credits them.
// Looks in the main Discord Guild only.
async function UpdateVoiceActiveMembersForMainDiscordGuild() {
    const guild = await DiscordUtil.GetMainDiscordGuild();
    await UpdateVoiceActiveMembersForOneGuild(guild);
}

// Looks for 2 or more users in voice channels together and credits them.
//
// guild - Looks for voice channels in this guild only.
async function UpdateVoiceActiveMembersForOneGuild(guild) {
    const listOfLists = [];
    for (const [channelId, channel] of guild.channels.cache) {
	if (channel.type === 'voice') {
	    const channelActive = [];
	    for (const [memberId, member] of channel.members) {
		if (member.voice.mute || member.voice.deaf) {
		    continue;
		}
		const cu = await UserCache.GetCachedUserByDiscordId(member.user.id);
		if (!cu) {
		    // Shouldn't happen, but ignore and hope for recovery.
		    continue;
		}
		channelActive.push(cu.commissar_id);
	    }
	    if (channelActive.length >= 2) {
		listOfLists.push(channelActive);
	    }
	}
    }
    console.log('Voice active members by ID:');
    console.log(listOfLists);
    timeTogetherStream.seenTogether(listOfLists);
}

async function UpdateHarmonicCentrality() {
    const candidates = await UserCache.GetAllCitizenCommissarIds();
    if (candidates.length === 0) {
	throw 'ERROR: zero candidates.';
    }
    const centralityScoresById = await HarmonicCentrality(candidates);
    await UserCache.BulkCentralityUpdate(centralityScoresById);
    const mostCentral = await UserCache.GetMostCentralUsers(74);
    await DiscordUtil.UpdateHarmonicCentralityChatChannel(mostCentral);
}

async function SetGoodStandingIfVerified(cu, member) {
    const guild = await DiscordUtil.GetMainDiscordGuild();
    const role = await DiscordUtil.GetRoleByName(guild, 'Verified');
    const isVerified = DiscordUtil.GuildMemberHasRole(member, role);
    const isOnTrial = cu.ban_vote_end_time;
    if (isVerified && !isOnTrial) {
	console.log('Detected Verified role', member.nickname);
	await cu.setGoodStanding(true);
	await DiscordUtil.RemoveRole(member, role);
	await DiscordUtil.RemoveRole(member, RoleID.Unverified);
	await UpdateMemberAppearance(member);
	console.log('Done verifying', member.nickname);
    }
}

async function UpdateAllCitizens() {
    const guild = await DiscordUtil.GetMainDiscordGuild();
    await UserCache.ForEach(async (user) => {
	if (user.citizen) {
	    console.log(`Checking user ${user.nickname} (ID:${user.commissar_id}).`);
	    const discordMember = await RateLimit.Run(async () => {
		try {
		    return await guild.members.fetch(user.discord_id);
		} catch (error) {
		    return null;
		}
	    });
	    if (!discordMember) {
		await user.setCitizen(false);
		return;
	    }
	    await user.setNickname(discordMember.user.username);
	    await DestroyFriendSectionForCommissarUser(user, guild);
	    await SetGoodStandingIfVerified(user, discordMember);
	}
	// Update ban trial even if the defendant leaves the guild.
	await Ban.UpdateTrial(user);
    });
}

async function DestroyFriendSectionForCommissarUser(cu, guild) {
    if (!cu.friend_category_id) {
	return;
    }
    const section = await guild.channels.resolve(cu.friend_category_id);
    await cu.setFriendCategorityId(null);
    await cu.setFriendTextChatId(null);
    await cu.setFriendVoiceRoomId(null);
}

// Enforces a time cap per 24h period between every pair of members. This stops
// idling in Discord from paying off.
async function FilterTimeTogetherRecordsToEnforceTimeCap(timeTogetherRecords) {
    console.log('Enforcing time cap.', timeTogetherRecords.length, 'input records.');
    const timeMatrix24h = await DB.GetTimeMatrix24h();
    console.log('Loaded 24h time matrix with', Object.keys(timeMatrix24h).length, 'rows.');
    const matchingRecords = [];
    for (const r of timeTogetherRecords) {
	const timeTogether24h = (timeMatrix24h[r.lo_user_id] || {})[r.lo_user_id] || 0;
	if (timeTogether24h < 3600) {
	    matchingRecords.push(r);
	} else {
	    console.log('Enforced time cap:', r.lo_user_id, r.hi_user_id);
	}
    }
    console.log('Enforcing time cap.', matchingRecords.length, 'output records.');
    return matchingRecords;
}

// The 60-second heartbeat event. Take care of things that need attention each minute.
async function MinuteHeartbeat() {
    if (RateLimit.Busy()) {
	return;
    }
    console.log('Minute heartbeat');
    await UpdateHarmonicCentrality();
    await Rank.UpdateUserRanks();
    await UpdateAllDiscordMemberAppearances();
    await UpdateVoiceActiveMembersForMainDiscordGuild();
    const recordsToSync = timeTogetherStream.popTimeTogether(9000);
    const timeCappedRecords = await FilterTimeTogetherRecordsToEnforceTimeCap(recordsToSync);
    await DB.WriteTimeTogetherRecords(timeCappedRecords);
}

// The hourly heartbeat event. Take care of things that need attention once an hour.
async function HourlyHeartbeat() {
    console.log('Hourly heartbeat');
    console.log('Consolidating the time matrix.');
    await DB.ConsolidateTimeMatrix();
    await UpdateAllCitizens();
}

// Waits for the database and bot to both be connected, then finishes booting the bot.
async function Start() {
    console.log('Waiting for Discord bot to connect.');
    const discordClient = await DiscordUtil.Connect();
    console.log('Discord bot connected. Waiting for the database to connect.');
    await DB.Connect();
    console.log('Database connected. Loading commissar user data.');
    await UserCache.LoadAllUsersFromDatabase();
    console.log('Commissar user data loaded.');

    // This Discord event fires when someone joins a Discord guild that the bot is a member of.
    discordClient.on('guildMemberAdd', async (member) => {
	console.log('Someone joined the guild.');
	if (member.user.bot) {
	    // Ignore other bots.
	    return;
	}
	const greeting = `Everybody welcome ${member.user.username} to the server!`;
	await DiscordUtil.MessagePublicChatChannel(greeting);
	const cu = await UserCache.GetCachedUserByDiscordId(member.user.id);
	if (cu) {
	    await cu.setCitizen(true);
	} else {
	    // We have no record of this Discord user. Create a new record in the cache.
	    console.log('New Discord user detected.');
	    await UserCache.CreateNewDatabaseUser(member);
	    await DiscordUtil.AddRole(member, RoleID.Unverified);
	}
    });

    // Emitted whenever a member leaves a guild, or is kicked.
    discordClient.on('guildMemberRemove', async (member) => {
	console.log('Someone left the guild.');
	const cu = await UserCache.GetCachedUserByDiscordId(member.user.id);
	if (!cu) {
	    return;
	}
	await cu.setCitizen(false);
    });

    // Emitted whenever a member is banned from a guild.
    discordClient.on('guildBanAdd', async (guild, user) => {
	console.log('Someone got banned.');
	const cu = await UserCache.GetCachedUserByDiscordId(user.id);
	if (!cu) {
	    return;
	}
	await cu.setCitizen(false);
    });

    // Respond to bot commands.
    discordClient.on('message', async (message) => {
	const cu = await UserCache.GetCachedUserByDiscordId(message.author.id);
	if (!cu) {
	    // Shouldn't happen. Bail and hope for recovery.
	    return;
	}
	await cu.setCitizen(true);
	await BotCommands.Dispatch(message);
    });

    // This Discord event fires when someone joins or leaves a voice chat channel, or mutes,
    // unmutes, deafens, undefeans, and possibly other circumstances as well.
    discordClient.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
	console.log('voiceStateUpdate', newVoiceState.member.nickname);
	UpdateVoiceActiveMembersForMainDiscordGuild();
	const cu = await UserCache.GetCachedUserByDiscordId(newVoiceState.member.user.id);
	if (!cu) {
	    // Shouldn't happen. Bail and hope for recovery.
	    return;
	}
	await cu.setCitizen(true);
	await cu.seenNow();
	if (cu.good_standing === false) {
	    await newVoiceState.member.voice.kick();
	}
	await huddles.Update();
    });

    // When a user changes their username or other user details.
    discordClient.on('userUpdate', async (oldUser, newUser) => {
	console.log('userUpdate', newUser.username);
	const cu = await UserCache.GetCachedUserByDiscordId(newUser.id);
	await cu.setNickname(newUser.username);
    });

    // When a guild member changes their nickname or other details.
    discordClient.on('guildMemberUpdate', async (oldMember, newMember) => {
	console.log('guildMemberUpdate', newMember.user.username);
	const cu = await UserCache.GetCachedUserByDiscordId(newMember.user.id);
	if (!cu) {
	    return;
	}
	await cu.setNickname(newMember.user.username);
	await cu.setCitizen(true);
	await SetGoodStandingIfVerified(cu, newMember);
    });

    discordClient.on('messageReactionAdd', async (messageReaction, user) => {
	console.log('react', user.username, messageReaction.emoji.name);
	const cu = await UserCache.GetCachedUserByDiscordId(user.id);
	if (!cu) {
	    return;
	}
	await cu.setCitizen(true);
	await Ban.HandlePossibleReaction(messageReaction, user, true);
    });

    discordClient.on('messageReactionRemove', async (messageReaction, user) => {
	console.log('unreact', user.username, messageReaction.emoji.name);
	const cu = await UserCache.GetCachedUserByDiscordId(user.id);
	if (!cu) {
	    return;
	}
	await Ban.HandlePossibleReaction(messageReaction, user, false);
    });

    // Set up heartbeat events. These run at fixed intervals of time.
    const oneSecond = 1000;
    const oneMinute = 60 * oneSecond;
    const oneHour = 60 * oneMinute;
    // Set up the hour and minute heartbeat routines to run on autopilot.
    setInterval(HourlyHeartbeat, oneHour);
    setInterval(MinuteHeartbeat, oneMinute);
    await MinuteHeartbeat();
    await HourlyHeartbeat();
}

Start();
