# Migration Notes for Contract Placement Marketplace System

## Important: Database Migration Required

This implementation replaces the existing binary tree contract system with a new contract placement marketplace system. You **must** run a database migration before using the new system.

## Steps to Migrate

1. **Backup your database** (if you have existing data you want to preserve)

2. **Run Prisma migration:**
   ```bash
   cd backend_vortex
   npx prisma migrate dev --name contract_placement_marketplace
   ```

   This will:
   - Drop the old `Contract` table
   - Create new tables: `ContractGame`, `Unit`, `PurchaseRequest`
   - Update `User` table (add `mentorId` field)
   - Update `Payout` table (change from `contractId` to `unitId`)
   - Add all necessary indexes

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

4. **Seed initial data (optional):**
   - Create at least one admin user
   - Create at least one mentor user
   - Create a contract game through the admin interface

## Breaking Changes

- The old `Contract` model has been completely removed
- All existing contract-related API endpoints have been replaced
- Frontend components using the old contract system need to be updated

## New System Overview

- **ContractGame**: Admin-created games with configurable down payments and payouts
- **Unit**: Individual units purchased by users, placed in a tree structure (4 units per level)
- **PurchaseRequest**: User requests to purchase units, requires mentor approval
- **Placement Algorithm**: 5-step algorithm for placing units (odd → mentor's active, even → user's active)
- **Fulfillment**: Units complete when next N levels are filled (Stage 1: 3 levels, Stage 2/3: 2 levels)

## Testing

After migration, test the following:
1. Admin can create contract games
2. Users can create purchase requests
3. Mentors can approve/reject requests
4. Mentors can place units
5. Units complete and trigger payouts correctly

