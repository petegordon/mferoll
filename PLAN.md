# UI Simplification Plan

## Issues to Fix

1. **Balance Display** - Shows 0 ETH instead of test balance
2. **UI Too Complex** - Too many options, overwhelming
3. **Bet Types** - Remove all options for now, just roll dice
4. **Camera Angle** - Change from angled to top-down view
5. **iOS Motion Permissions** - Not prompting for permission on touch

---

## Proposed Changes

### 1. Simplified Layout
- Full-screen dice view (top-down camera)
- Minimal header with just logo + wallet connect
- Test balance shown prominently when connected
- Single "Shake to Roll" instruction text
- No betting panel for now

### 2. Camera View
- Position camera directly above dice looking down
- Dice centered in view
- Clean dark background (felt table look)

### 3. iOS Motion Permission Fix
- Add explicit "Enable Shake" button that appears on first load
- Button triggers the DeviceMotionEvent.requestPermission()
- Store permission state in localStorage
- Show clear feedback when shake is enabled

### 4. Simplified Flow
```
Connect Wallet → See Balance → Shake Phone → Dice Roll → See Result
```

### 5. Components to Modify
- `page.tsx` - Remove BetPanel, simplify layout
- `DiceScene.tsx` - Top-down camera
- `ShakeDetector.tsx` - Add permission button for iOS
- `TokenBalance.tsx` / `TestBalance.tsx` - Fix display

### 6. Components to Hide/Remove (for now)
- BetPanel
- PredictionSelector
- All bet type logic (keep code but don't render)

---

## New UI Mockup

```
┌─────────────────────────────────┐
│ DiceRoll          [Connect] │
├─────────────────────────────────┤
│                                 │
│         Test: 10,000 MFER       │
│                                 │
│         ┌───┐    ┌───┐         │
│         │ ⚄ │    │ ⚂ │         │
│         └───┘    └───┘         │
│                                 │
│          Result: 4 + 3 = 7      │
│                                 │
│     [ Enable Shake to Roll ]    │  ← Only shows on iOS before permission
│                                 │
│        🔄 Shake to Roll!        │  ← Shows after permission granted
│                                 │
└─────────────────────────────────┘
```

---

## Implementation Steps

1. Fix iOS motion permission flow with explicit button
2. Change camera to top-down view
3. Simplify page.tsx - remove betting UI
4. Fix balance display to show test MFER
5. Add "Shake to Roll" instruction
6. Test on iOS Chrome

Ready to implement?
