# Contract Game Structure & Profit Distribution

## Overview

A **Contract Game** is created by an Admin and defines the rules for unit placement and profit distribution. Users purchase units to participate in the game.

## Contract Game Components

### 1. Basic Information
- **Name**: Unique identifier for the game (e.g., "Game 2024", "Premium Contract")
- **Down Payment**: Amount required per unit to participate
  - Example: $100 per unit
  - Minimum purchase: 4 units = $400 total

### 2. Profit Structure (Payouts)

Each contract game has **3 stages** with configurable payout amounts:

#### Stage 1 Payout
- **When**: Unit completes Stage 1 (next 3 levels filled = 14 units)
- **Amount**: Configurable by admin (e.g., $1,000)
- **Example**: User gets $1,000 when their unit completes Stage 1

#### Stage 2 Payout
- **When**: Unit completes Stage 2 (next 2 levels filled = 6 units)
- **Amount**: Configurable by admin (e.g., $2,000)
- **Example**: User gets $2,000 when their unit completes Stage 2

#### Stage 3 Payout
- **When**: Unit completes Stage 3 (next 2 levels filled = 6 units)
- **Amount**: Configurable by admin (e.g., $3,000)
- **Example**: User gets $3,000 when their unit completes Stage 3

### 3. Total Profit Potential

If a user's unit completes all 3 stages:
- **Total Investment**: 4 units × $100 = $400
- **Total Profit**: $1,000 + $2,000 + $3,000 = $6,000
- **Net Profit**: $6,000 - $400 = $5,600

## Example Contract Game

```
Game Name: "Premium Contract 2024"
Down Payment: $100 per unit
Minimum Purchase: 4 units = $400

Profit Structure:
├── Stage 1 Completion: $1,000
├── Stage 2 Completion: $2,000
└── Stage 3 Completion: $3,000

Total Potential Profit: $6,000
Net Profit: $5,600 (after $400 investment)
```

## How It Works

### Step 1: Admin Creates Contract Game
```json
{
  "name": "Premium Contract 2024",
  "downPayment": 100.00,
  "payoutStage1": 1000.00,
  "payoutStage2": 2000.00,
  "payoutStage3": 3000.00
}
```

### Step 2: User Purchases Units
- User requests to purchase 4 units (minimum)
- Total cost: 4 × $100 = $400
- Mentor approves the request
- Units are placed in the tree structure

### Step 3: Units Complete Stages
- As more users join, units fill the tree
- When a unit's fulfillment requirements are met, it completes
- Payout is automatically credited to user's wallet
- Unit moves to next stage (or completes if Stage 3)

### Step 4: Profit Distribution
- Each payout is automatically added to user's wallet
- User can withdraw funds from wallet
- All transactions are tracked

## Fulfillment Requirements

### Stage 1 Completion
- Requires: Next 3 levels filled
- Total units needed: 14 units (4+4+4+2)
- Active unit stays active until 4 units in 4th level

### Stage 2 Completion
- Requires: Next 2 levels filled
- Total units needed: 6 units (4+2)
- Active unit stays active until 4 units in 3rd level

### Stage 3 Completion
- Requires: Next 2 levels filled
- Total units needed: 6 units (4+2)
- This is the final stage

## Profit Calculation Example

**Scenario**: User purchases 4 units in "Premium Contract 2024"

```
Investment:
- 4 units × $100 = $400

Potential Earnings:
- Unit 101 completes Stage 1: +$1,000
- Unit 101 completes Stage 2: +$2,000
- Unit 101 completes Stage 3: +$3,000
- Unit 102 completes Stage 1: +$1,000
- Unit 102 completes Stage 2: +$2,000
- Unit 102 completes Stage 3: +$3,000
- ... (same for units 103 and 104)

Total Potential: $24,000 (4 units × $6,000 each)
Net Profit: $23,600 (after $400 investment)
```

## Important Notes

1. **Minimum Purchase**: Users must buy at least 4 units
2. **Automatic Payouts**: Payouts are automatically credited to wallet when units complete
3. **Multiple Units**: Users can purchase more units in the same or different games
4. **Tree Structure**: Units are placed using the 5-step placement algorithm
5. **Active Units**: Only one unit per user per game per stage can be active at a time

## API Endpoint for Creating Contract Game

**POST** `/api/admin/contract-games`

```json
{
  "name": "Premium Contract 2024",
  "downPayment": 100.00,
  "payoutStage1": 1000.00,
  "payoutStage2": 2000.00,
  "payoutStage3": 3000.00
}
```

This creates a contract game where:
- Users pay $100 per unit
- Minimum 4 units = $400 investment
- They can earn $1,000 + $2,000 + $3,000 = $6,000 per unit if it completes all stages

