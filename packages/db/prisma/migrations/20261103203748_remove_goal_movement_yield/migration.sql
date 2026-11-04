BEGIN;
CREATE TYPE "GoalMovementType_new" AS ENUM ('DEPOSIT', 'WITHDRAWAL');
ALTER TABLE "goal_movement" ALTER COLUMN "type" TYPE "GoalMovementType_new" USING ("type"::text::"GoalMovementType_new");
ALTER TYPE "GoalMovementType" RENAME TO "GoalMovementType_old";
ALTER TYPE "GoalMovementType_new" RENAME TO "GoalMovementType";
DROP TYPE "public"."GoalMovementType_old";
COMMIT;

