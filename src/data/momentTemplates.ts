import type { MomentCategory, StreamCategory } from '../types/game';

/** `{n}` is replaced with the streamer name. All content is fictional. */
export interface MomentTemplate {
  description: string;
  subject: string;
  quote: string;
}

type Bank = Record<MomentCategory, MomentTemplate[]>;

const gaming: Bank = {
  funny: [
    { description: '{n} gets launched across the map by a physics glitch and narrates the whole flight.', subject: 'Gets Launched Into Orbit By A Glitch', quote: 'Ladies and gentlemen, we are airborne.' },
    { description: '{n} hides from an enemy for five minutes. The enemy was a coat rack.', subject: 'Hides From A Coat Rack For 5 Minutes', quote: 'Do not look at me. Do NOT look at me.' },
    { description: 'A teammate accidentally voice-chats a full grocery list while {n} tries to strategize.', subject: 'Strategy Call Ruined By A Grocery List', quote: 'Okay but do we need eggs or not?' },
  ],
  rage: [
    { description: '{n} loses a 40-minute run to a single pixel and stares into the void.', subject: 'Loses 40 Minutes To One Pixel', quote: 'One. Pixel. ONE.' },
    { description: '{n} rage-quits, un-quits, and rage-quits again within 30 seconds.', subject: 'Rage Quits Twice In 30 Seconds', quote: 'I am done. ...One more. I am DONE.' },
    { description: 'The final boss one-shots {n} after a flawless fight. The scream peaks the mic.', subject: 'Gets One-Shot After A Flawless Fight', quote: 'That is NOT a real attack!' },
  ],
  emotional: [
    { description: '{n} finally beats the level they have failed for three weeks and goes quiet.', subject: 'Finally Beats The Level After 3 Weeks', quote: 'I... I did it. Chat, I did it.' },
    { description: 'A viewer donates to say {n}\'s streams got them through a rough year.', subject: 'Reads A Message That Changes Everything', quote: 'You have no idea what that means to me.' },
  ],
  unexpected: [
    { description: 'A random player walks up to {n} and drops the rarest item in the game.', subject: 'Gets Handed The Rarest Item By A Stranger', quote: 'Wait. WAIT. Why would you do that?' },
    { description: '{n}\'s cat walks across the keyboard and somehow lands the perfect combo.', subject: 'Cat Lands A Perfect Combo', quote: 'My cat is better than me. Clip it.' },
    { description: 'The power cuts out mid-match. When it returns, {n} somehow won.', subject: 'Wins A Match During A Power Cut', quote: 'I was not even here!' },
  ],
  controversial: [
    { description: '{n} claims the most loved game of the decade is "mid" and chat explodes.', subject: 'Calls The Most Loved Game "Mid"', quote: 'It is mid. I said what I said.' },
    { description: '{n} accuses a rival team of exploiting a bug on stream.', subject: 'Calls Out A Rival Team Live', quote: 'Everybody saw that. Everybody.' },
  ],
  gameplay: [
    { description: '{n} pulls off a 1-versus-5 clutch with 2 HP left.', subject: 'Clutches A 1v5 On 2 HP', quote: 'Do not breathe. Nobody breathe.' },
    { description: '{n} discovers a shortcut that skips half the level.', subject: 'Finds A Shortcut That Skips Half The Level', quote: 'Is this... allowed?' },
    { description: 'A frame-perfect dodge chain from {n} that chat replays fifty times.', subject: 'Hits A Frame-Perfect Dodge Chain', quote: 'Muscle memory, baby.' },
  ],
  quote: [
    { description: '{n} delivers a surprisingly wise speech about failure mid-match.', subject: 'Drops Unexpected Life Advice Mid-Match', quote: 'You do not lose. You either win or you learn.' },
    { description: '{n} coins a new catchphrase that chat spams for an hour.', subject: 'Invents A New Catchphrase', quote: 'Skill issue? No. Vibe issue.' },
  ],
};

const podcast: Bank = {
  funny: [
    { description: 'The guest tells a story about getting stuck in a revolving door for an hour.', subject: 'Guest Got Stuck In A Revolving Door', quote: 'It kept going. I kept going.' },
    { description: '{n}\'s co-host laughs so hard the chair tips over backwards.', subject: 'Co-Host Falls Off Chair Laughing', quote: 'Are you okay? ARE you okay?' },
  ],
  rage: [
    { description: '{n} goes on a five-minute rant about people who clap when planes land.', subject: 'Rants About Plane Clappers', quote: 'Who are you clapping FOR?' },
    { description: 'A sponsor read goes wrong and {n} snaps at the producer.', subject: 'Snaps During A Sponsor Read', quote: 'Who wrote this? Who wrote THIS?' },
  ],
  emotional: [
    { description: 'The guest talks about the day they almost quit, and {n} tears up.', subject: 'Guest Shares The Day They Almost Quit', quote: 'I sat in my car for an hour and just breathed.' },
    { description: '{n} reads a letter from their younger self out loud.', subject: 'Reads A Letter From Their Younger Self', quote: 'You were right to keep going.' },
    { description: 'A caller thanks {n} for advice that helped them reconnect with their dad.', subject: 'Caller Reconnected With Their Dad', quote: 'We talk every Sunday now.' },
  ],
  unexpected: [
    { description: 'A surprise guest walks in mid-episode. Nobody on set knew.', subject: 'Surprise Guest Walks In Mid-Episode', quote: 'Wait, how did you get in here?' },
    { description: '{n} reveals they once won a regional yodeling contest.', subject: 'Reveals A Secret Yodeling Past', quote: 'I was the champion. Two years running.' },
  ],
  controversial: [
    { description: '{n} declares that breakfast is the most overrated meal and refuses to back down.', subject: 'Says Breakfast Is Overrated', quote: 'Breakfast is a marketing campaign.' },
    { description: 'The hosts argue whether a hot dog is a sandwich. It gets personal.', subject: 'Hot Dog Debate Gets Personal', quote: 'This is why we cannot have nice things.' },
    { description: '{n} says remote work made people lazier. The comments are on fire.', subject: 'Hot Take On Remote Work', quote: 'Pajamas are not a work ethic.' },
  ],
  gameplay: [
    { description: 'The hosts try a mobile game live and {n} is shockingly good at it.', subject: 'Host Is Secretly Cracked At Mobile Games', quote: 'I have been practicing. In secret.' },
  ],
  quote: [
    { description: '{n} sums up adulthood in one perfect sentence.', subject: 'Sums Up Adulthood In One Sentence', quote: 'Being an adult is googling things with confidence.' },
    { description: 'A one-liner about ambition that the whole table repeats.', subject: 'One-Liner About Ambition', quote: 'Nobody is coming. Build it anyway.' },
    { description: '{n} gives the best breakup advice ever recorded.', subject: 'Gives The Best Breakup Advice Ever', quote: 'You did not lose them. You found you.' },
  ],
};

const irl: Bank = {
  funny: [
    { description: 'A pigeon steals {n}\'s sandwich in front of a live audience of 9,000.', subject: 'Robbed By A Pigeon Live', quote: 'That bird has a family to feed, apparently.' },
    { description: '{n} tries to order in a new language and orders 12 lemons.', subject: 'Accidentally Orders 12 Lemons', quote: 'I just wanted a coffee.' },
  ],
  rage: [
    { description: 'A scooter rental app charges {n} for a ride across the ocean.', subject: 'Charged For A Scooter Ride Across The Ocean', quote: 'I did NOT ride into the sea.' },
  ],
  emotional: [
    { description: 'A street musician plays {n}\'s late grandmother\'s favorite song by chance.', subject: 'Street Musician Plays Grandma\'s Song', quote: 'She used to sing this every morning.' },
    { description: '{n} reunites a lost dog with its owner on stream.', subject: 'Reunites A Lost Dog With Its Owner', quote: 'Look at that tail go.' },
  ],
  unexpected: [
    { description: 'A flash mob breaks out around {n} and they are somehow part of the choreography.', subject: 'Accidentally Joins A Flash Mob', quote: 'Did anyone tell me about this?' },
    { description: '{n} bumps into a famous fictional chef who invites them into the kitchen.', subject: 'Invited Into A Famous Kitchen', quote: 'Chef said "yes, chef" to ME.' },
    { description: 'A tourist recognizes {n} and asks for a photo... with their camera, not them.', subject: 'Fan Only Wanted The Camera', quote: 'Oh. Okay. Love that for you.' },
  ],
  controversial: [
    { description: '{n} rates a famous local dish a 4/10 while standing in the restaurant.', subject: 'Rates Local Legend Dish 4/10 Inside The Restaurant', quote: 'I respect it. I do not like it.' },
    { description: 'A street interview with {n} about tipping culture turns into a shouting match.', subject: 'Tipping Debate Turns Into Shouting Match', quote: 'Tip the vending machine too, then!' },
  ],
  gameplay: [
    { description: '{n} wins an arcade claw machine on the first try.', subject: 'Wins Claw Machine First Try', quote: 'Rigged? I AM the rig.' },
  ],
  quote: [
    { description: 'A stranger gives {n} life advice at a bus stop.', subject: 'Stranger Gives Life Advice At A Bus Stop', quote: 'The bus always comes. Be on time anyway.' },
    { description: '{n} reflects on a sunset and says something surprisingly deep.', subject: 'Gets Deep During A Sunset', quote: 'Every day ends. That is what makes it count.' },
  ],
};

export const MOMENT_BANK: Record<StreamCategory, Bank> = { gaming, podcast, irl };

export const QUESTION_TITLES: Record<MomentCategory, string[]> = {
  funny: ['How Is This Even Real?', 'Can Anyone Explain What Happened Here?'],
  rage: ['Why Does This Always Happen To {n}?', 'Was {n} Right To Lose It?'],
  emotional: ['Did This Just Make {n} Cry?', 'Why Is Everyone Talking About This Moment?'],
  unexpected: ['Did That Really Just Happen?', 'Wait... What Just Happened?'],
  controversial: ['Is {n} Right About This?', 'Did {n} Go Too Far?'],
  gameplay: ['Is This The Best Play Of The Year?', 'How Did {n} Pull This Off?'],
  quote: ['Is This The Best Advice Ever?', 'Did {n} Just Say The Truest Thing?'],
};

export const HYPE_TITLES: Record<MomentCategory, string[]> = {
  funny: ['{N} CANNOT STOP LAUGHING', 'THIS IS THE FUNNIEST THING ON STREAM'],
  rage: ['{N} COMPLETELY LOSES IT', '{N} ABSOLUTELY SNAPS'],
  emotional: ['{N} BREAKS DOWN LIVE', 'THE MOST WHOLESOME MOMENT EVER'],
  unexpected: ['NOBODY SAW THIS COMING', '{N} WAS NOT READY'],
  controversial: ['{N} STARTS A WAR', 'CHAT IS FURIOUS'],
  gameplay: ['{N} IS INSANE', 'THE CLEANEST PLAY EVER'],
  quote: ['{N} SPEAKS FACTS', 'THIS LINE IS LEGENDARY'],
};
