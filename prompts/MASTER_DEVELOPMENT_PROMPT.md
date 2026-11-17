# PROJECT: CLIP TO RICHES

## Role
Act as a senior indie game developer, game designer, pixel-art game architect, and frontend engineer.
Build a complete, interactive browser-based 2D pixel-art tycoon game. Do not build a static dashboard
that merely resembles a game.

## Game concept
The player starts with $250 in a small bedroom and tries to build a livestream-clipping business.
The player discovers fictional streamers, finds interesting moments, edits clips, publishes them to
fictional platforms, grows views and followers, earns virtual money, upgrades equipment, hires staff,
automates operations, and eventually builds a media empire.

Gameplay is hybrid:
- Early game: manual stream discovery, moment selection, editing, and publishing.
- Mid game: hire staff and automate selected tasks.
- Late game: manage an agency, partnerships, multiple channels, and strategic decisions.

## Technology
- TypeScript
- React
- Phaser 3 for the 2D game world, characters, environments, and interactions
- Vite
- Zustand for shared state
- IndexedDB for persistent game saves

React owns menus, dashboards, overlays, shop, analytics, and management screens.
Phaser owns the room, player character, interactive objects, and world animations.
Keep simulation logic separate from presentation.

## Visual direction
Create a polished 16-bit pixel-art indie game:
- Cozy dark retro atmosphere
- Purple, cyan, and blue accent lighting
- Crisp pixel edges and consistent pixel scale
- Detailed but readable environments
- Pixel-art character and furniture
- Modern, legible UI panels and typography
- Smooth transitions and subtle sound effects

Avoid generic admin-dashboard styling. The browser experience must feel like a game.

## Starting environment
Create a small rented bedroom office with:
- Player character
- Desk, old laptop, monitor, chair
- Bed, window, decorations, cables
- Interactive computer
- Clear visual affordances for clickable objects

Progression environments:
1. Bedroom office
2. Creator studio
3. Clipping agency
4. Large media office
5. International media empire

## Main screens
- Main Office
- Stream Browser
- Clip Studio
- Publishing Center
- Analytics
- Employee Management
- Equipment Shop
- Creator Partnerships
- Business Management
- Achievements

Every visible control must work. Do not ship dead buttons.

## Core systems

### Stream discovery
Create fictional streamers with name, portrait, category, popularity, audience profile,
stream duration, and available moments. Initial examples:
- PixelRage — gaming
- The Daily Mic — podcast
- NovaLive — IRL
- ChaosKing — gaming
- ChillCast — podcast

Give each streamer distinct traits and audience preferences.

### Moment discovery
Each stream has multiple fictional moments. Categories:
- Funny
- Rage
- Emotional
- Unexpected
- Controversial
- Gameplay
- Memorable quote

Each moment has hidden attributes:
- Virality potential
- Originality
- Audience relevance
- Competition
- Trend relevance

Make moment selection a meaningful decision, not a random button.

### Clip editor
Build an interactive clip-editing flow:
- Select a moment
- Adjust start and end points or duration
- Choose title and hook
- Select subtitle style
- Add effects
- Choose thumbnail
- Preview a representative clip card
- Calculate editing quality

Editing choices and player skills must influence performance.

### Publishing and platform simulation
Create fictional platforms with different:
- Audiences
- Content preferences
- Algorithm behavior
- Engagement patterns
- Monetization requirements

Clip performance should combine clip quality, audience fit, trend relevance, account reputation,
platform fit, and controlled randomness. Do not guarantee virality.

### Economy
Revenue sources:
- Platform monetization
- Sponsored content
- Creator partnerships
- Agency contracts

Expenses:
- Equipment
- Software
- Salaries
- Rent
- Marketing
- Operating costs

Views are not automatically money. Monetization eligibility and platform rules matter.

### Employees
Roles:
- Junior Editor
- Senior Editor
- Trend Researcher
- Social Media Manager
- Operations Manager

Each employee has salary, productivity, experience, skills, work capacity, and upgrade potential.
Employees should gradually automate tasks, with clear operating costs and capacity limits.

### Progression
Skill trees:
- Editing
- Trend Sense
- Marketing
- Management
- Networking

Unlock features through experience, milestones, and money.

### Events
Examples:
- Streamer popularity spike
- Algorithm change
- Copyright claim
- Competitor activity
- Viral clip
- Exclusive creator deal
- Employee request

Events should create meaningful choices and consequences.

## Initial game state
- Cash: $250
- Followers: 0
- Employees: 0
- Equipment: Basic laptop
- Office: Bedroom
- Reputation: 0

## Saving
Implement autosave, manual save, load, new game, save versioning, validation, and capped offline progress.
Use IndexedDB for durable saves. Handle corrupted or outdated save data safely.

## Build phases
### Phase 1 — playable prototype
- Project setup
- Pixel-art bedroom and character
- Navigation
- Stream discovery
- Moment selection
- Clip editor
- Publishing simulation
- Money, followers, and analytics
- Local save/load

### Phase 2 — business systems
- Equipment shop
- Monetization eligibility
- Creator partnerships
- Skills
- Random events
- Performance history

### Phase 3 — agency
- Hiring and firing
- Employee productivity
- Automatic discovery/editing/publishing
- Multiple channels
- Office expansion
- Salaries and expenses

### Phase 4 — polish
- Advanced progression
- Achievements
- Competitors
- Audio and animations
- Responsive layouts
- Balancing and QA

## Development rules
- Inspect the existing repository before changing anything.
- Do not overwrite working functionality without a clear reason.
- Avoid duplicate components and duplicated game logic.
- Use strict TypeScript types and interfaces.
- Keep data configurable and simulation logic testable.
- Separate UI, game world, state, and simulation systems.
- Make the game responsive and keyboard accessible where practical.
- Test all important interactions.
- Do not claim completion without running the app and testing it.
- Do not use real streamer footage or copyrighted clips; use fictional, simulated content in the initial release.
- Use original or properly licensed art and audio.

## First deliverable
Implement Phase 1 only. A player must be able to:
1. Start a new game.
2. Enter the bedroom office.
3. Open the streamer browser.
4. Select a streamer.
5. Discover available moments.
6. Select a moment.
7. Edit a clip.
8. Publish it.
9. See simulated views and engagement.
10. Earn money and followers.
11. View analytics.
12. Save and reload progress.

Before coding:
- Inspect the repository.
- Propose a concise implementation plan.
- Identify key interfaces and file ownership.
- Then implement Phase 1.

After coding:
- Run the app.
- Run type checks and tests.
- Fix errors.
- Verify the complete first-day gameplay loop.

Final report:
- Files created/modified
- Features implemented
- Tests performed
- Known issues
- Commands to run the game
