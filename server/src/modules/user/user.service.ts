import argon2 from "@node-rs/argon2";
import { pgPool } from "../../config/db.postgres.js";
import { AppError } from "../../shared/errors.js";
import type {
  UpdateProfileInput,
  UpdateHealthInput,
  ChangePasswordInput,
  DeleteAccountInput,
} from "./user.schema.js";
import {
  calculateCaloricTarget,
  calculateWaterTarget,
  type BiologicalSex,
  type ActivityLevel,
  type AgeRange,
} from "../../shared/calculations.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FullProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  provider: string;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
  health: {
    region: string | null;
    dietary_style: string | null;
    health_goal: string | null;
    allergies: string[];
    health_conditions: string[];
    calorie_target: number | null;
    biological_sex: string | null;
    activity_level: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    age_range: string | null;
    exact_age: number | null;
    water_target_ml: number | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Get full profile including health data
// Single query using LEFT JOIN so we get user and health in one round trip.
// LEFT JOIN means we still return the user even if health_profile row does not exist yet (edge case during onboarding).
// ---------------------------------------------------------------------------
export const getFullProfile = async (userId: string): Promise<FullProfile> => {
  const result = await pgPool.query(
    `SELECT
       u.id, u.email, u.display_name, u.avatar_url,
       u.role, u.is_verified, u.provider,u.created_at, u.last_login_at,
       hp.region, hp.dietary_style, hp.health_goal,
       hp.allergies, hp.health_conditions, hp.calorie_target,
       hp.biological_sex, hp.activity_level, hp.height_cm, hp.weight_kg, hp.age_range, hp.exact_age, hp.water_target_ml
     FROM users u
     LEFT JOIN health_profiles hp ON hp.user_id = u.id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  // Shape the flat JOIN result into a nested object.
  // This gives the frontend a clean structure to work with.
  const profile: FullProfile = {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    role: row.role,
    provider: row.provider,
    is_verified: row.is_verified,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
    health: row.region !== undefined
      ? {
          region: row.region,
          dietary_style: row.dietary_style,
          health_goal: row.health_goal,
          allergies: row.allergies ?? [],
          health_conditions: row.health_conditions ?? [],
          calorie_target: row.calorie_target,
          biological_sex: row.biological_sex,
          activity_level: row.activity_level,
          height_cm: row.height_cm,
          weight_kg: row.weight_kg,
          age_range: row.age_range,
          exact_age: row.exact_age,
          water_target_ml: row.water_target_ml,
        }
      : null,
  };

  return profile;
};

// ---------------------------------------------------------------------------
// Update basic profile fields
// Only updates fields that were actually provided in the request.
// Fields not included in the request are left unchanged.
// ---------------------------------------------------------------------------
export const updateProfile = async ( userId: string, input: UpdateProfileInput ): Promise<FullProfile> => {
  // Build the SET clause dynamically based on which fields were provided.
  // This avoids overwriting fields with undefined when only one field changes.
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.display_name !== undefined) {
    fields.push(`display_name = $${paramIndex++}`);
    values.push(input.display_name);
  }

  if (input.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramIndex++}`);
    values.push(input.avatar_url);
  }

  // If nothing was provided, nothing to update
  if (fields.length === 0) {
    throw new AppError(
      "No fields provided to update",
      400,
      "NO_UPDATE_FIELDS"
    );
  }

  values.push(userId);

  await pgPool.query(
    `UPDATE users 
    SET ${fields.join(", ")} WHERE id = $${paramIndex} 
    AND deleted_at IS NULL`,
    values
  );

  // Return the full updated profile
  return getFullProfile(userId);
};

// ---------------------------------------------------------------------------
// Update health profile
// ---------------------------------------------------------------------------
export const updateHealthProfile = async (
  userId: string,
  input: UpdateHealthInput
): Promise<FullProfile> => {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.region !== undefined) {
    fields.push(`region = $${paramIndex++}`);
    values.push(input.region);
  }

  if (input.dietary_style !== undefined) {
    fields.push(`dietary_style = $${paramIndex++}`);
    values.push(input.dietary_style);
  }

  if (input.health_goal !== undefined) {
    fields.push(`health_goal = $${paramIndex++}`);
    values.push(input.health_goal);
  }

  if (input.allergies !== undefined) {
    fields.push(`allergies = $${paramIndex++}`);
    values.push(JSON.stringify(input.allergies));
  }

  if (input.health_conditions !== undefined) {
    fields.push(`health_conditions = $${paramIndex++}`);
    values.push(JSON.stringify(input.health_conditions));
  }

// ---------------------------------------------------------------------------
  // Auto-calculate calorie target and water target when relevant fields change.
  // We fetch current profile values first so partial updates (e.g. only
  // weight changing) still have everything needed for the formulas.
  //
  // calorie_target and water_target_ml each have exactly ONE of three states
  // per request, and each pushes to `fields` AT MOST ONCE to avoid the
  // "multiple assignments to same column" Postgres error.
  //   undefined  -> field not touched this request. leave database value as is.
  //   null       -> explicit reset. recalculate and store the auto value.
  //   a number   -> manual override. store exactly what was provided.
  // ---------------------------------------------------------------------------
  const shouldRecalculate =
    input.biological_sex !== undefined ||
    input.activity_level !== undefined ||
    input.height_cm      !== undefined ||
    input.weight_kg      !== undefined ||
    input.age_range      !== undefined ||
    input.exact_age      !== undefined ||
    input.health_goal    !== undefined ||
    input.calorie_target === null ||
    input.water_target_ml === null;

  let current: any = {};
  if (shouldRecalculate) {
    const currentResult = await pgPool.query(
      `SELECT biological_sex, activity_level, height_cm, weight_kg,
              age_range, exact_age, health_goal,
              calorie_target, water_target_ml
       FROM health_profiles WHERE user_id = $1`,
      [userId]
    );
    current = currentResult.rows[0] ?? {};
  }

  const sex = (input.biological_sex ?? current.biological_sex) as BiologicalSex | null;
  const activity = (input.activity_level ?? current.activity_level) as ActivityLevel | null;
  const height = input.height_cm   ?? current.height_cm;
  const weight = input.weight_kg   ?? current.weight_kg;
  const goal = input.health_goal ?? current.health_goal;
  const ageForCalc: number | AgeRange | null =
    input.exact_age ?? current.exact_age ??
    input.age_range ?? current.age_range ??
    null;

  // ---------------------------------------------------------------------------
  // calorie_target. exactly one path runs.
  // ---------------------------------------------------------------------------
  if (input.calorie_target === null) {
    // Explicit reset requested. recalculate if we have everything needed.
    if (sex && activity && height && weight && ageForCalc) {
      const autoCalorie = calculateCaloricTarget(sex, weight, height, ageForCalc, activity, goal);
      fields.push(`calorie_target = $${paramIndex++}`);
      values.push(autoCalorie);
    } else {
      // Not enough data to calculate. store null as requested. frontend
      // should prompt the user to complete their profile for auto calculation.
      fields.push(`calorie_target = $${paramIndex++}`);
      values.push(null);
    }
  } else if (input.calorie_target !== undefined) {
    // Manual numeric override provided.
    fields.push(`calorie_target = $${paramIndex++}`);
    values.push(input.calorie_target);
  } else if (
    current.calorie_target === null && // not fetched above, meaning shouldRecalculate path for OTHER fields changed
    sex && activity && height && weight && ageForCalc
  ) {
    // calorie_target was not mentioned in this request at all, but other
    // formula inputs changed and no calorie_target has ever been set.
    // Auto-calculate for the first time.
    const autoCalorie = calculateCaloricTarget(sex, weight, height, ageForCalc, activity, goal);
    fields.push(`calorie_target = $${paramIndex++}`);
    values.push(autoCalorie);
  }

  // ---------------------------------------------------------------------------
  // water_target_ml. exactly one path runs. same three-state pattern.
  // ---------------------------------------------------------------------------
  if (input.water_target_ml === null) {
    if (sex && activity) {
      const autoWater = calculateWaterTarget(sex, activity);
      fields.push(`water_target_ml = $${paramIndex++}`);
      values.push(autoWater);
    } else {
      fields.push(`water_target_ml = $${paramIndex++}`);
      values.push(null);
    }
  } else if (input.water_target_ml !== undefined) {
    fields.push(`water_target_ml = $${paramIndex++}`);
    values.push(input.water_target_ml);
  } else if (shouldRecalculate && sex && activity && current.water_target_ml === null) {
    // water_target_ml not mentioned this request, but other fields changed
    // and no water target has ever been set. auto-calculate for first time.
    const autoWater = calculateWaterTarget(sex, activity);
    fields.push(`water_target_ml = $${paramIndex++}`);
    values.push(autoWater);
  }

  // Handle the new fields in the dynamic SET builder
  if (input.biological_sex !== undefined) {
    fields.push(`biological_sex = $${paramIndex++}`);
    values.push(input.biological_sex);
  }
  if (input.activity_level !== undefined) {
    fields.push(`activity_level = $${paramIndex++}`);
    values.push(input.activity_level);
  }
  if (input.height_cm !== undefined) {
    fields.push(`height_cm = $${paramIndex++}`);
    values.push(input.height_cm);
  }
  if (input.weight_kg !== undefined) {
    fields.push(`weight_kg = $${paramIndex++}`);
    values.push(input.weight_kg);
  }
  if (input.age_range !== undefined) {
    fields.push(`age_range = $${paramIndex++}`);
    values.push(input.age_range);
  }
  if (input.exact_age !== undefined) {
    fields.push(`exact_age = $${paramIndex++}`);
    values.push(input.exact_age);
  }

  if (fields.length === 0) {
    throw new AppError(
      "No fields provided to update",
      400,
      "NO_UPDATE_FIELDS"
    );
  }

  // Always update the updated_at timestamp
  fields.push(`updated_at = NOW()`);
  values.push(userId);

  await pgPool.query(
    `UPDATE health_profiles SET ${fields.join(", ")} WHERE user_id = $${paramIndex}`,
    values
  );

  return getFullProfile(userId);
};

// ---------------------------------------------------------------------------
// Change password
// Requires current password verification before allowing the change.
// Revokes all refresh tokens after change, forcing re-login on all devices.
// ---------------------------------------------------------------------------
export const changePassword = async ( userId: string, input: ChangePasswordInput ): Promise<void> => {
  // Fetch current password hash
  const result = await pgPool.query(
    "SELECT password_hash, provider FROM users WHERE id = $1 AND deleted_at IS NULL",
    [userId]
  );

  const user = result.rows[0];
  console.log("[REMOVE LOG LATER] User details for password change attempt:", user);

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  // OAuth users have no password. they cannot use this endpoint.
  if (user.provider !== "local" || !user.password_hash) {
    throw new AppError(
      "This account uses Google sign-in and has no password to change.",
      400,
      "OAUTH_ACCOUNT"
    );
  }

  // Verify current password before allowing change
  const currentPasswordValid = await argon2.verify(
    user.password_hash,
    input.current_password
  );

  if (!currentPasswordValid) {
    throw new AppError(
      "Current password is incorrect",
      401,
      "INVALID_PASSWORD"
    );
  }

  const newPasswordHash = await argon2.hash(input.new_password);

  await pgPool.query(
    "UPDATE users SET password_hash = $1 WHERE id = $2",
    [newPasswordHash, userId]
  );

  // Revoke all refresh tokens. user must log in again on all devices.
  await pgPool.query(
    "UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1",
    [userId]
  );

  console.log(
    `[REMOVE LOG LATER] Password changed. all sessions revoked for user. ${userId}`
  );
};

// ---------------------------------------------------------------------------
// Delete account. soft delete. Requires password confirmation to prevent accidental deletion.
// Sets deleted_at timestamp. All queries filter WHERE deleted_at IS NULL so the account becomes invisible to the entire application immediately.
// ---------------------------------------------------------------------------
export const deleteAccount = async ( userId: string, input: DeleteAccountInput ): Promise<void> => {
  const result = await pgPool.query(
    "SELECT password_hash, provider FROM users WHERE id = $1 AND deleted_at IS NULL",
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  if (user.provider !== "local" || !user.password_hash) {
    throw new AppError(
      "This account uses Google sign-in. Please contact support to delete your account.",
      400,
      "OAUTH_ACCOUNT"
    );
  }

  const passwordValid = await argon2.verify(user.password_hash, input.password);

  if (!passwordValid) {
    throw new AppError(
      "Incorrect password. Account deletion cancelled.",
      401,
      "INVALID_PASSWORD"
    );
  }

  // Revoke all sessions first
  await pgPool.query(
    "UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1",
    [userId]
  );

  // Soft delete the account
  await pgPool.query(
    "UPDATE users SET deleted_at = NOW() WHERE id = $1",
    [userId]
  );

  console.log(
    `[REMOVE LOG LATER] Account soft deleted. ${userId}`
  );
};

//------------------------------------------------------------------------------------
//Save user's timezone
//------------------------------------------------------------------------------------
export const setTimezone = async (userId: string, timezone: string): Promise<void> => {
  //fetch cuent user
  const result = await pgPool.query(
    "SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL",
    [userId]
  );
  const user = result.rows[0];

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  await pgPool.query(
    "UPDATE users SET timezone = $1 WHERE id = $2", [timezone, userId]
  );

}
