# Contract Positioning System - Demo Guide

## Overview
This guide explains how to set up and demonstrate the UpStage Contract Positioning System with example data.

## Prerequisites
1. Database migrations have been run: `npm run db:migrate`
2. Basic seed data exists (admin user, etc.): `npm run db:seed`

## Setting Up Demo Contracts

### Step 1: Run Database Migration
First, ensure the Contract schema is applied:
```bash
npm run db:migrate
```

### Step 2: Seed Demo Contracts
Run the contract seeder to create example contracts:
```bash
npm run db:seed:contracts
```

This will create:
- **15 demo users** (demo1@example.com through demo15@example.com, password: `demo123`)
- **Multiple contract trees** showing the positioning system
- **Example fulfilled contract** with payout
- **All contracts have $1000 down payment**

## Demo Contract Structure

### Main Tree (John Smith - demo1@example.com)
```
Root Contract #101 (Level 0)
├── Level 1: 3 contracts (102, 103, 104)
│   ├── Level 2: 4 contracts each (105-116)
│   │   └── Level 3: 4 contracts (117-120)
│   │       └── Level 4: 4 contracts (121-124)
```

### Second Tree (Sarah Johnson - demo2@example.com)
```
Root Contract #101 (Level 0)
└── Contract #102 (FULFILLED, moved to Stage 2)
    └── Has payout record ($1000)
```

## Demo User Accounts

All demo users have the password: `demo123`

| Email | Name | Role |
|-------|------|------|
| demo1@example.com | John Smith | USER |
| demo2@example.com | Sarah Johnson | USER |
| demo3@example.com | Mike Williams | USER |
| demo4@example.com | Emily Brown | USER |
| demo5@example.com | David Jones | USER |
| demo6@example.com | Lisa Davis | USER |
| demo7@example.com | Tom Wilson | USER |
| demo8@example.com | Anna Martinez | USER |
| demo9@example.com | Chris Anderson | USER |
| demo10@example.com | Jessica Taylor | USER |
| demo11@example.com | Ryan Thomas | USER |
| demo12@example.com | Amanda Jackson | USER |
| demo13@example.com | Kevin White | USER |
| demo14@example.com | Michelle Harris | USER |
| demo15@example.com | Daniel Martin | USER |

## Demo Scenarios

### Scenario 1: View Contract Tree
1. Login as `demo1@example.com` / `demo123`
2. Navigate to Contracts page
3. View the contract tree visualization
4. See the hierarchical structure with multiple levels

### Scenario 2: View Contract Details
1. Click on any contract card
2. See contract details including:
   - Contract number and stage
   - Down payment ($1000)
   - Fulfillment progress
   - Children contracts
   - Owner and host information

### Scenario 3: View Fulfilled Contract
1. Login as `demo2@example.com` / `demo123`
2. Navigate to Contracts page
3. Find contract #102 (marked as FULFILLED)
4. View details to see:
   - Stage 2 status
   - Payout amount ($1000)
   - Fulfillment timestamp

### Scenario 4: View Payouts
1. Login as `demo2@example.com` / `demo123`
2. Navigate to Contracts > Payouts
3. See payout history with:
   - Total earnings
   - Pending/Processed/Failed status
   - Link to related contracts

### Scenario 5: Create New Contract
1. Login as any demo user
2. Click "Create Contract" button
3. System will automatically:
   - Assign contract number (next in sequence)
   - Place contract in tree based on odd/even logic
   - Set down payment requirement

## Key Features to Demonstrate

### 1. Down Payment System
- Every contract requires a $1000 down payment
- Displayed on contract cards and details page
- Tracked in the database

### 2. Contract Positioning
- **Odd numbers (101, 103, 105...)**: Placed under host's active contract
- **Even numbers (102, 104, 106...)**: Placed under own active contract
- Automatic tree placement (left-to-right, bottom-to-top)

### 3. Fulfillment System
- **Stage 1**: Requires 3 in Level 1, 4 in Level 2, 4 in Level 3, and 4 in Level 4
- **Stage 2/3**: Requires 3 in Level 1, 4 in Level 2, and 4 in Level 3
- Automatic stage progression
- Payout calculation and creation

### 4. Tree Visualization
- Interactive expandable/collapsible tree
- Color-coded by stage
- Status indicators (Active *, Fulfilled +, Inactive ○)

## API Endpoints for Demo

### Get User Contracts
```bash
GET /api/contracts/my-contracts
Authorization: Bearer <token>
```

### Get Contract Tree
```bash
GET /api/contracts/tree
Authorization: Bearer <token>
```

### Get Contract Details
```bash
GET /api/contracts/:id
Authorization: Bearer <token>
```

### Get Payouts
```bash
GET /api/contracts/payouts
Authorization: Bearer <token>
```

### Create Contract
```bash
POST /api/contracts/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostId": "optional-host-id"
}
```

## Resetting Demo Data

To reset and reseed contracts:
```bash
# Option 1: Delete contracts manually via Prisma Studio
npm run db:studio

# Option 2: Reset entire database (WARNING: Deletes all data)
npx prisma migrate reset

# Then reseed
npm run db:seed
npm run db:seed:contracts
```

## Troubleshooting

### Contracts not showing
- Ensure migrations are run: `npm run db:migrate`
- Check if seed script ran successfully
- Verify user is logged in with correct token

### Tree visualization not loading
- Check browser console for errors
- Verify contract data structure in database
- Ensure React Query is properly configured

### Down payment not displaying
- Check if `downPayment` field exists in contract data
- Verify frontend is using latest contract type definition
- Clear browser cache and reload

## Next Steps

1. **Customize Payout Amounts**: Edit environment variables:
   ```
   CONTRACT_PAYOUT_STAGE_1=1000
   CONTRACT_PAYOUT_STAGE_2=2000
   CONTRACT_PAYOUT_STAGE_3=3000
   ```

2. **Adjust Down Payment**: Modify in `contractSeeder.js`:
   ```javascript
   downPayment: 1000.00 // Change this value
   ```

3. **Add More Demo Data**: Extend `contractSeeder.js` to create more complex scenarios

4. **Test Fulfillment**: Manually trigger fulfillment checks via API or UI

