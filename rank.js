
function GenerateIdealRanksSorted(n) {
    // President, VP, and Generals.
    const ranks = [
	13, 12,
	11, 11,
	10, 10, 10, 10,
	9, 9, 9, 9, 9,
	8, 8, 8, 8, 8, 8
    ];
    if (n <= ranks.length) {
	return ranks.slice(0, n).reverse();
    }
    // Officers: max 10 people per rank.
    let remaining = n - ranks.length;
    for (let r = 7; r >= 4; --r) {
	const equalSlice = Math.floor(remaining / r);
	const howMany = Math.min(equalSlice, 10);
	for (let j = 0; j < howMany; ++j) {
	    ranks.push(r);
	}
	remaining -= howMany;
    }
    // Grunts: same number of people at each rank.
    for (let r = 3; r >= 1; --r) {
	const equalSlice = Math.floor(remaining / r);
	for (let j = 0; j < equalSlice; ++j) {
	    ranks.push(r);
	}
	remaining -= equalSlice;
    }
    return ranks.reverse();
}

const metadata = [
    {index: 0, title: 'n00b', insignia: '(n00b)', role: null},
    {index: 1, title: 'Recruit', insignia: '●', role: 'Grunt'},
    {index: 2, title: 'Corporal', insignia: '●●', role: 'Grunt'},
    {index: 3, title: 'Sergeant', insignia: '●●●', role: 'Grunt'},
    {index: 4, title: 'Lieutenant', insignia: '●', role: 'Officer'},
    {index: 5, title: 'Captain', insignia: '●●', role: 'Officer'},
    {index: 6, title: 'Major', insignia: '●●●', role: 'Officer'},
    {index: 7, title: 'Colonel', insignia: '●●●●', role: 'Officer'},
    {index: 8, title: 'General', insignia: '★', role: 'General'},
    {index: 9, title: 'General', insignia: '★★', role: 'General'},
    {index: 10, title: 'General', insignia: '★★★', role: 'General'},
    {index: 11, title: 'General', insignia: '★★★★', role: 'General'},
    {
	index: 12,
	title: 'Mr. Vice President',
	insignia: '⚑',
	role: 'Marshal',
	nicknameOverride: 'Mr. Vice President'
    },
    {
	index: 13,
	title: 'Mr. President',
	insignia: '⚑',
	role: 'Marshal',
	nicknameOverride: 'Mr. President'
    },
];

const rankMetadata = [
    {
	abbreviation: 'Mr.',
	count: 1,
	insignia: '⚑',
	maxDirects: 1,
	nicknameOverride: true,
	role: 'Marshal',
	title: 'President',
    },
    {
	abbreviation: 'Mr.',
	count: 1,
	insignia: '⚑',
	maxDirects: 2,
	nicknameOverride: true,
	role: 'Marshal',
	title: 'Vice President',
    },
    {
	abbreviation: 'Gen.',
	count: 2,
	insignia: '★★★★',
	maxDirects: 2,
	role: 'General',
	title: 'General',
    },
    {
	abbreviation: 'Gen.',
	count: 4,
	insignia: '★★★',
	maxDirects: 2,
	role: 'General',
	title: 'General',
    },
    {
	abbreviation: 'Gen.',
	count: 5,
	insignia: '★★',
	maxDirects: 2,
	role: 'General',
	title: 'General',
    },
    {
	abbreviation: 'Gen.',
	count: 6,
	insignia: '★',
	maxDirects: 2,
	role: 'General',
	title: 'General',
    },
    {
	abbreviation: 'Col.',
	count: 7,
	insignia: '●●●●',
	maxDirects: 2,
	role: 'Officer',
	title: 'Colonel',
    },
    {
	abbreviation: 'Maj.',
	count: 9,
	insignia: '●●●',
	maxDirects: 2,
	role: 'Officer',
	title: 'Major',
    },
    {
	abbreviation: 'Capt.',
	count: 11,
	insignia: '●●',
	maxDirects: 2,
	role: 'Officer',
	title: 'Captain',
    },
    {
	abbreviation: 'Lt.',
	count: 13,
	insignia: '●',
	maxDirects: 2,
	role: 'Officer',
	title: 'Lieutenant',
    },
    {
	abbreviation: 'Sgt.',
	count: 15,
	insignia: '●●●',
	maxDirects: 2,
	role: 'Grunt',
	title: 'Sergeant',
    },
    {
	abbreviation: 'Cpl.',
	count: 17,
	insignia: '●●',
	maxDirects: 5,
	role: 'Grunt',
	title: 'Corporal',
    },
    {
	abbreviation: 'Pvt.',
	count: 999,
	insignia: '●',
	maxDirects: 0,
	role: 'Grunt',
	title: 'Private',
    },
];

// Return the commissar user record with the highest participation score
// from among the given canidates.
function GetUserWithHighestParticipationScore(candidates) {
    let maxScore;
    let maxUserRecord;
    Object.keys(candidates).forEach((id) => {
	const cu = candidates[id];
	if (!cu || !cu.participation_score) {
	    return;
	}
	if (!maxScore || cu.participation_score > maxScore) {
	    maxScore = cu.participation_score;
	    maxUserRecord = cu;
	}
    });
    return maxUserRecord;
}

function FilterFullBosses(bosses, maxDirects) {
    const newBosses = [];
    bosses.forEach((boss) => {
	if (boss.children.length < maxDirects) {
	    newBosses.push(boss);
	}
    });
    return newBosses;
}

// Calculate chain of command.
//
//   - presidentID: the Commissar ID of the chosen President to head
//                  the chain of command.
//   - candidates: an object mapping Commissar ID keys to CommissarUser
//                 objects from the user cache.
//   - relationships: a list of relationship records. Each record
//                    represents a relationship between a pair of
//                    people. Fields:
//                      - lo_user_id, hi_user_id: integer Commissar IDs
//                      - discounted_diluted_seconds: float (sec)
//
// Returns a dict of dicts representing the calculated chain of command.
// The outer dict is keyed by integer user ID. The inner records have
// these fields:
//   - id: integer Commissar ID.
//   - boss: integer Commissar ID of boss. undefined for Mr. President
//           to indicate that Mr. President has no boss.
//   - children: list of Commmisar IDs of direct children.
//   - rank: integer depth in the tree = rank assigned. Lower number
//           means higher rank.
//
// This function is pure ranking logic, with no connection to database
// calls or other external dependencies. It is unit-testable offline.
function CalculateChainOfCommand(presidentID, candidates, relationships) {
    return {
	1: {
	    id: 1,
	    boss: 2,
	    rank: 1,
	},
	2: {
	    id: 2,
	    children: [1],
	    rank: 0,
	},
    };
}

module.exports = {
    CalculateChainOfCommand,
    GenerateIdealRanksSorted,
    metadata,
};
