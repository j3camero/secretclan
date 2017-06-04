const Discord = require('discord.js');

const token = '***REMOVED***';

const ranks = [
    {title: 'n00b', insignia: '(n00b)', role: null},
    {title: 'Recruit', insignia: '●', role: 'Grunt'},
    {title: 'Corporal', insignia: '●●', role: 'Grunt'},
    {title: 'Sergeant', insignia: '●●●', role: 'Grunt'},
    {title: 'Lieutenant', insignia: '●', role: 'Officer'},
    {title: 'Captain', insignia: '●●', role: 'Officer'},
    {title: 'Major', insignia: '●●●', role: 'Officer'},
    {title: 'Colonel', insignia: '●●●●', role: 'Officer'},
    {title: 'General', insignia: '★', role: 'General'},
    {title: 'General', insignia: '★★', role: 'General'},
    {title: 'General', insignia: '★★★', role: 'General'},
    {title: 'General', insignia: '★★★★', role: 'General'},
];

const client = new Discord.Client();

function GetRoleByName(guild, roleName) {
    for (let role of guild.roles.values()) {
	if (role.name === roleName) {
	    return role.id;
	}
    }
}

function ApplyRankToMember(rank, member, guild) {
    console.log('Rank ' + member.user.username + ' ' + rank.title + ' ' + rank.insignia);
    member.setNickname(member.user.username + ' ' + rank.insignia);
    const role = GetRoleByName(guild, rank.role);
    member.setRoles([role]);
}

function RankGuildMembers(guild) {
    let candidates = [];
    for (let member of guild.members.values()) {
	if (member.user.id != guild.ownerID && !member.user.bot) {
	    candidates.push(member);
	}
    }
    candidates.sort(function(a, b) {
	return b.joinedTimestamp - a.joinedTimestamp;
    });
    let rank = 1;
    for (let member of candidates) {
	ApplyRankToMember(ranks[rank], member, guild);
	++rank;
    }
}

client.on('ready', () => {
    console.log('ready');
    for (let guild of client.guilds.values()) {
	RankGuildMembers(guild);
    }
});

client.on('guildMemberAdd', member => {
    const greeting = 'Everybody welcome ' + member.user.username + ' to the server!';
    member.guild.defaultChannel.send(greeting);
    RankGuildMembers(member.guild);
});

client.login(token);
