// Helper functions not specific to any particular Discord bot.

// Looks up the ID of a Discord role by name.
function GetRoleByName(guild, roleName) {
  for (let role of guild.roles.values()) {
    if (role.name === roleName) {
        return role.id;
    }
  }
}

// Checks if a Discord guild member has a role, by name.
function GuildMemberHasRole(member, roleName) {
  let found = false;
  member.roles.forEach((role) => {
    if (role.name === roleName) {
      found = true;
    }
  });
  return found;
}

// Returns a list of text channels with names that match channelName.
function GetAllMatchingTextChannels(guild, channelName) {
  const matchingChannels = [];
  guild.channels.forEach((channel) => {
    if (channel.name === channelName && channel.type === 'text') {
      matchingChannels.push(channel);
    }
  });
  return matchingChannels;
}

// Returns the main text chat channel for a discord guild.
function GetMainChatChannel(guild) {
  // First, look for any text channel called #main.
  const mains = GetAllMatchingTextChannels(guild, 'main');
  if (mains.length > 0) {
    return mains[0];
  }
  // If no #main found, look for any text channel called #general.
  const generals = GetAllMatchingTextChannels(guild, 'general');
  if (generals.length > 0) {
    return generals[0];
  }
  // If no #main or #general found, return any text channel at all.
  let matchingChannel;
  guild.channels.forEach((channel) => {
    if (channel.type === 'text') {
      matchingChannel = channel;
    }
  });
  if (matchingChannel) {
    return matchingChannel;
  }
  // If no text channels found at all, give up.
  return null;
}

// Returns a list of non-muted users active in voice channels right now.
// Excludes alone users. Each user must be with another active user to count.
function GetVoiceActiveMembers(guild) {
  let guildActive = [];
  guild.channels.forEach((channel) => {
    if (channel.type === 'voice') {
      const channelActive = [];
      channel.members.forEach((member) => {
        if (!member.mute) {
          channelActive.push(member);
        }
      });
      if (channelActive.length >= 2) {
        guildActive = guildActive.concat(channelActive);
      }
    }
  });
  return guildActive;
}

module.exports = {
  GetAllMatchingTextChannels,
  GetMainChatChannel,
  GetRoleByName,
  GetVoiceActiveMembers,
  GuildMemberHasRole,
};
