const ChainOfCommand = require('./chain-of-command');
const DB = require('./database');
const jobDescriptions = require('./executive-config');
const FilterUsername = require('./filter-username');
const moment = require('moment');

// Represents a member of the guild.
class CommissarUser {
    constructor(
	commissar_id,
	discord_id,
	nickname,
	rank,
	last_seen,
	office,
	harmonic_centrality,
	peak_rank,
	gender,
	citizen,
        friend_role_id,
        friend_category_id,
        friend_text_chat_id,
        friend_voice_room_id) {
	this.commissar_id = commissar_id;
	this.discord_id = discord_id;
	this.nickname = nickname;
	this.rank = rank;
	this.last_seen = last_seen;
	this.office = office;
	this.harmonic_centrality = harmonic_centrality;
	this.peak_rank = peak_rank;
	this.gender = gender;
	this.citizen = citizen;
	this.friend_role_id = friend_role_id;
	this.friend_category_id = friend_category_id;
	this.friend_text_chat_id = friend_text_chat_id;
	this.friend_voice_room_id = friend_voice_room_id;
    }

    async setDiscordId(discord_id) {
	if (discord_id === this.discord_id) {
	    return;
	}
	this.discord_id = discord_id;
	await this.updateFieldInDatabase('discord_id', this.discord_id);
    }

    async setNickname(nickname) {
	nickname = FilterUsername(nickname);
	if (nickname === this.nickname) {
	    return;
	}
	this.nickname = nickname;
	await this.updateFieldInDatabase('nickname', this.nickname);
    }

    async setRank(rank) {
	if (rank === this.rank) {
	    return;
	}
	this.rank = rank;
	await this.updateFieldInDatabase('rank', this.rank);
	await this.setPeakRank(this.rank);
    }

    async seenNow() {
	this.last_seen = moment().format();
	await this.updateFieldInDatabase('last_seen', this.last_seen);
    }

    async setOffice(office) {
	if (office === this.office) {
	    return;
	}
	this.office = office;
	await this.updateFieldInDatabase('office', this.office);
    }

    async setHarmonicCentrality(new_centrality) {
	if (new_centrality === this.harmonic_centrality) {
	    return;
	}
	this.harmonic_centrality = new_centrality;
	await this.updateFieldInDatabase('harmonic_centrality', this.harmonic_centrality);
    }

    async setPeakRank(peak_rank) {
	// Lower ranks are more senior, in the database.
	if (!this.peak_rank || peak_rank < this.peak_rank) {
	    this.peak_rank = peak_rank;
	    await this.updateFieldInDatabase('peak_rank', this.peak_rank);
	}
    }

    async setGender(gender) {
	// Gender is any capital ASCII letter in the database. M, F, L, G, B, T, Q...
	if (!gender) {
	    throw `Invalid gender value: ${gender}`;
	}
	if (gender === this.gender) {
	    // Bail because the same value is already in the cache. Not an error.
	    return;
	}
	if (typeof gender !== 'string' || gender.length !== 1) {
	    throw 'Gender has to be a string of length 1. It says so in the Bible!';
	}
	this.gender = gender;
	await this.updateFieldInDatabase('gender', this.gender);
    }

    // True or false value. Represents whether or not this user is a member of the
    // Discord guild. Members who have left or been banned will have the value false.
    async setCitizen(is_citizen) {
	if ((is_citizen && this.citizen) || (!is_citizen && !this.citizen)) {
	    return;
	}
	this.citizen = is_citizen;
	await this.updateFieldInDatabase('citizen', this.citizen);
    }

    async setFriendRoleId(friend_role_id) {
	if (friend_role_id === this.friend_role_id) {
	    return;
	}
	this.friend_role_id = friend_role_id;
	await this.updateFieldInDatabase('friend_role_id', this.friend_role_id);
    }

    async setFriendCategorityId(friend_category_id) {
	if (friend_category_id === this.friend_category_id) {
	    return;
	}
	this.friend_category_id = friend_category_id;
	await this.updateFieldInDatabase('friend_category_id', this.friend_category_id);
    }

    async setFriendTextChatId(friend_text_chat_id) {
	if (friend_text_chat_id === this.friend_text_chat_id) {
	    return;
	}
	this.friend_text_chat_id = friend_text_chat_id;
	await this.updateFieldInDatabase('friend_text_chat_id', this.friend_text_chat_id);
    }

    async setFriendVoiceRoomId(friend_voice_room_id) {
	if (friend_voice_room_id === this.friend_voice_room_id) {
	    return;
	}
	this.friend_voice_room_id = friend_voice_room_id;
	await this.updateFieldInDatabase('friend_voice_room_id', this.friend_voice_room_id);
    }

    async updateFieldInDatabase(fieldName, fieldValue) {
	console.log(`DB update ${fieldName} = ${fieldValue} for ${this.nickname} (ID:${this.commissar_id}).`);
	const sql = `UPDATE users SET ${fieldName} = ? WHERE commissar_id = ?`;
	const values = [fieldValue, this.commissar_id];
	const result = await DB.Query(sql, values);
	if (result.affectedRows !== 1) {
	    throw `Updated wrong number of records. Should only update 1 (${result.affectedRows}).`;
	}
    }

    getGenderPrefix() {
	if (this.gender === 'F') {
	    return 'Madam';
	} else {
	    return 'Mr.';
	}
    }

    getNicknameOrTitle() {
	if (!this.office) {
	    return this.nickname;
	}
	const job = jobDescriptions[this.office];
	if (job.title) {
	    const prefix = this.getGenderPrefix();
	    return `${prefix} ${job.title}`;
	} else {
	    return this.nickname;
	}
    }

    getInsignia() {
	if (this.commissar_id === 6) {
	    // Brobob memorial insignia: President for Life.
	    return '★★★★★';
	}
	const rankData = ChainOfCommand.metadata[this.rank];
	return rankData.insignia;
    }

    getNicknameWithInsignia() {
	const insignia = this.getInsignia();
	return `${this.nickname} ${insignia}`;
    }

    getNicknameOrTitleWithInsignia() {
	const name = this.getNicknameOrTitle();
	const insignia = this.getInsignia();
	return `${name} ${insignia}`;
    }
}

module.exports = CommissarUser;
