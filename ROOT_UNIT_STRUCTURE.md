# Root Unit Structure & Host/Mentor Tracking

## Overview

Each **Contract Game** has a **system root unit** for each stage (Stage 1, 2, 3). This root unit is owned by the system/admin and serves as the starting point for the tree structure. All user units are placed under this root or its descendants.

## System Root Units

### Creation
When a contract game is created, **3 system root units** are automatically created:
- **Stage 1 Root**: `SYSTEM_ROOT_S1` (unitNumber: 0, level: 0)
- **Stage 2 Root**: `SYSTEM_ROOT_S2` (unitNumber: 0, level: 0)
- **Stage 3 Root**: `SYSTEM_ROOT_S3` (unitNumber: 0, level: 0)

### Properties
- **Owner**: Admin/System user
- **Unit Number**: 0 (special number for roots)
- **Unit Name**: `SYSTEM_ROOT_S{stage}`
- **Level**: 0 (root level)
- **Parent**: None (null)
- **isSystemRoot**: true
- **isActive**: true (always active)

## Tree Structure

```
Contract Game: "Premium Contract 2024"
│
├── Stage 1 Root (SYSTEM_ROOT_S1) [Level 0, System Owned]
│   ├── User A Unit 101 (odd) [Level 1, Position 1]
│   │   ├── User A Unit 102 (even) [Level 2, Position 1]
│   │   ├── User B Unit 101 (odd) [Level 2, Position 2]
│   │   └── ...
│   ├── User C Unit 101 (odd) [Level 1, Position 2]
│   └── ...
│
├── Stage 2 Root (SYSTEM_ROOT_S2) [Level 0, System Owned]
│   └── (Units placed here when Stage 1 units complete)
│
└── Stage 3 Root (SYSTEM_ROOT_S3) [Level 0, System Owned]
    └── (Units placed here when Stage 2 units complete)
```

## Host/Mentor Tracking

### Mentor (mentorId)
- **Who**: The mentor who approved and placed the unit
- **Purpose**: Track which mentor is responsible for placing units
- **Set When**: Unit is placed by mentor
- **Example**: Mentor M approves User A's request → Mentor M's ID is stored in `mentorId`

### Host (hostId)
- **Who**: The user who sponsored/recruited the unit owner
- **Purpose**: Track the referral/host relationship
- **Set When**: 
  - **Odd units**: Mentor is the host (placed under mentor's active unit)
  - **Even units**: Mentor is also the host (they approved the request)
- **Example**: User A joins through Mentor M → Mentor M's ID is stored in `hostId`

## Placement Logic with Root Units

### First Unit Placement
1. **User purchases 4 units** (101, 102, 103, 104)
2. **Unit 101 (odd)**: 
   - Tries to place under mentor's active unit
   - If mentor has no active unit → places under **Stage 1 Root**
   - Mentor becomes the host
3. **Unit 102 (even)**:
   - Tries to place under user's own active unit (101)
   - If user has no active unit → places under **Stage 1 Root**
   - Mentor is still the host

### Subsequent Placements
- Once users have active units, new units are placed under those
- System root is only used as fallback when no active units exist

## Example Flow

```
1. Admin creates "Game 2024"
   → Creates 3 system root units (S1, S2, S3)

2. User A requests 4 units
   → Assigned to Mentor M

3. Mentor M approves request

4. Mentor M places units:
   - Unit 101 (odd) → Under Stage 1 Root (mentor has no active unit)
     - mentorId: Mentor M
     - hostId: Mentor M
   - Unit 102 (even) → Under Unit 101 (user's active unit)
     - mentorId: Mentor M
     - hostId: Mentor M
   - Unit 103 (odd) → Under Mentor M's active unit (if exists) or Root
     - mentorId: Mentor M
     - hostId: Mentor M
   - Unit 104 (even) → Under Unit 102
     - mentorId: Mentor M
     - hostId: Mentor M

5. User B requests 4 units
   → Assigned to Mentor M
   → Unit 101 (odd) → Under Mentor M's active unit (now exists)
     - mentorId: Mentor M
     - hostId: Mentor M
```

## Benefits

1. **Always Has a Root**: Every game has a system root, so first units can always be placed
2. **Host Tracking**: Know which mentor/user sponsored each unit
3. **Mentor Tracking**: Know which mentor placed each unit
4. **Tree Integrity**: All units trace back to the system root
5. **Referral System**: Can track which users were referred by which mentors

## Database Schema

```prisma
model Unit {
  // ... other fields
  mentorId    String?  // Mentor who placed this unit
  mentor      User?    @relation("UnitMentor")
  hostId      String?  // Host user (who sponsored/recruited)
  host        User?    @relation("UnitHost")
  isSystemRoot Boolean @default(false) // True for root units
}
```

## API Response

Units now include mentor and host information:

```json
{
  "id": "unit_123",
  "unitName": "john_101",
  "unitNumber": 101,
  "owner": {
    "id": "user_1",
    "email": "john@example.com"
  },
  "mentor": {
    "id": "mentor_1",
    "email": "mentor@example.com",
    "firstName": "Mentor",
    "lastName": "User"
  },
  "host": {
    "id": "mentor_1",
    "email": "mentor@example.com"
  },
  "parentUnit": {
    "id": "root_1",
    "unitName": "SYSTEM_ROOT_S1"
  }
}
```

