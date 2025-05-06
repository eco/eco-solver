import { formatUnits } from 'viem'

const distributionMessages = [
  `🌾 Well butter my biscuits! 🌾
We got ourselves a fresh harvest of {amount} ready for distribution! 🚜💰

The tappin' window opens up at {startTime}, so y'all best be ready to gather what's yours! 🪣⏰
Funds'll be rollin' outta the barn at {endTime} sharp. 🐄➡️🏦

Don't be late now — it's first come, first served, like pies at the county fair! 🥧👢`,
  `🌽 Heads up, farmhands! 🌽
There's a shiny new pot o' funds—{amount}—ready to be picked! 💰🚜

The tappin' gates swing open at {startTime}, so grab your buckets and be ready! 🪣🐓
Them funds'll be hitchin' a ride outta the silo at {endTime}—no lollygaggin'! ⏳🐄💨

Let's make hay while the sun shines! ☀️🌾`,
  `🥔 Well now, gather 'round y'all! 🥔
We've rustled up a new batch o' funds—{amount}—ready for the takin'! 💸🐖

The tappin' window cracks open at {startTime}, so don't be caught nappin' in the hay! 🕰️🛏️
Them coins'll be headin' out the gate come {endTime}, like cattle at sunrise. 🐄🌅

Saddle up and stake your claim, partners! 🐎🌻`,
  `Yeehaw! We got ourselves a {amount} payout ready to roll! 💵🐂

The tappin' corral opens at {startTime}, so hitch up and git in line! ⏰🪙
Funds'll stampede outta here by {endTime}—don't get left in the dust! 💨🐎

Let's ride, partners! 🌵🤠`,
  `🌼 Well bless your boots! A fresh bundle of {amount} is ripe for the pickin'. 🧺💰

We'll open the garden gate at {startTime}—time to gather your share nice and easy. 🕰️🧑‍🌾
By {endTime}, the bounty'll be on its way to each of y'all. 🌻📦

Harvest time is a gift—don't miss it! 🌾🍯`,
  `Oink oink! 🐖 It's feedin' time, folks—{amount} worth o' grub comin' your way! 💸🐽

Slop trough opens at {startTime}, so line up and get your snouts ready! 🕰️🪣
Funds'll be rootin' their way to ya by {endTime}—no pushin' in the pen now! 🐷💨

Happy harvest, hog wranglers! 🌽🎉`,
  `Out here in the fields, we've got a fresh yield: {amount} up for sharin'. 🌽💵

The tap gate opens at {startTime}, so pace yerselves, it ain't a sprint. 🕰️🚶‍♂️
When the rooster crows at {endTime}, them funds'll be headin' down the dirt road to ya. 🐓📬

May your barns be full and your wi-fi strong! 🌾📡`,
  `🪑 Now gather 'round, folks… 🪑
We've got a fresh haul of {amount} ready to be shared out across the farm. 💰🚜

The tappin' window opens at {startTime}, so best be ready with your buckets. 🕰️🪣
By {endTime}, them funds'll be rollin' out like a wagon full o' corn. 🌽🛻

Keep your boots dusty and your timing sharp! 🐾🧭`,
]

export function getRandomDistributionMessage(
  distributionAmount: bigint,
  startTime: Date,
  endTime: Date,
): string {
  const randomIndex = Math.floor(Math.random() * distributionMessages.length)
  const message = distributionMessages[randomIndex]
    .replace('{amount}', `$${formatUnits(distributionAmount, 6)}`)
    .replace('{startTime}', formatDate(startTime))
    .replace('{endTime}', formatDate(endTime))
  return message
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeStyle: 'full',
    timeZone: 'America/Los_Angeles',
  }).format(date)
}
