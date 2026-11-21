import { jsonResponse, errorResponse, verifyAuth, getCompanyAssets, saveCompanyAsset, recordAudit, getUsers } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  const user = await verifyAuth(request);
  if (!user) return errorResponse("Authentication required.", 401);

  try {
    const url = new URL(request.url);
    const filterUserId = url.searchParams.get("user_id");

    const users = await getUsers(env);
    let assets = await getCompanyAssets(env);

    if (user.role === "in_house_staff" || user.role === "third_party_tech") {
      // In-House & Tech can only view their own assets
      assets = assets.filter(a => String(a.user_id) === String(user.id));
    } else if (filterUserId) {
      assets = assets.filter(a => String(a.user_id) === String(filterUserId));
    }

    const enriched = assets.map(a => {
      const u = users.find(usr => usr.id === a.user_id);
      return {
        ...a,
        user_name: u ? u.name : "Unknown",
        user_mobile: u ? u.mobile : "",
        user_role: u ? u.role : "",
      };
    });

    return jsonResponse({ success: true, count: enriched.length, assets: enriched });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await verifyAuth(request);
  if (!user || user.role !== "admin") {
    return errorResponse("Only admin can create or assign company assets.", 403);
  }

  try {
    const body = await request.json();
    const { user_id, asset_name, asset_code, asset_id } = body;

    if (!asset_name) {
      return errorResponse("Asset name is required.", 400);
    }

    const cleanName = String(asset_name).trim();
    const cleanCode = asset_code ? String(asset_code).trim() : `AST-${Date.now().toString().slice(-4)}`;

    const users = await getUsers(env);
    const assets = await getCompanyAssets(env);

    // Case 1: Assigning an existing or new asset to a specific user
    if (user_id) {
      const assignedUser = users.find(u => u.id === Number(user_id));
      if (!assignedUser) return errorResponse("User not found.", 404);

      let targetAsset = null;
      if (asset_id) {
        targetAsset = assets.find(a => a.id === Number(asset_id));
      }

      if (targetAsset) {
        targetAsset.user_id = assignedUser.id;
        targetAsset.status = "active";
        targetAsset.assigned_date = new Date().toISOString();
        if (cleanName) targetAsset.asset_name = cleanName;
        if (cleanCode) targetAsset.asset_code = cleanCode;
        await saveCompanyAsset(env, targetAsset);
      } else {
        targetAsset = {
          id: Date.now(),
          user_id: assignedUser.id,
          asset_name: cleanName,
          asset_code: cleanCode,
          status: "active",
          assigned_date: new Date().toISOString(),
        };
        await saveCompanyAsset(env, targetAsset);
      }

      await recordAudit(env, {
        entity_type: "asset",
        entity_id: targetAsset.id,
        action_by_user_id: user.id,
        assigned_to_user_id: assignedUser.id,
        action_description_en: `Admin assigned company asset '${targetAsset.asset_name}' (${targetAsset.asset_code}) to ${assignedUser.name}.`,
        action_description_hi: `एडमिन ने कंपनी एसेट '${targetAsset.asset_name}' (${targetAsset.asset_code}) ${assignedUser.name} को सौंपा।`,
      });

      return jsonResponse({ success: true, asset: targetAsset, message: "Asset assigned successfully." });
    }

    // Case 2: Adding a new company asset / tool to Master Store (Unassigned)
    const newMasterAsset = {
      id: Date.now(),
      user_id: null,
      asset_name: cleanName,
      asset_code: cleanCode,
      status: "available",
      created_at: new Date().toISOString(),
    };

    await saveCompanyAsset(env, newMasterAsset);

    await recordAudit(env, {
      entity_type: "asset",
      entity_id: newMasterAsset.id,
      action_by_user_id: user.id,
      action_description_en: `Admin added new company tool '${newMasterAsset.asset_name}' (${newMasterAsset.asset_code}) to master repository.`,
      action_description_hi: `एडमिन ने नया कंपनी औजार '${newMasterAsset.asset_name}' (${newMasterAsset.asset_code}) मास्टर स्टोर में दर्ज किया।`,
    });

    return jsonResponse({ success: true, asset: newMasterAsset, message: "New asset created in master store." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const user = await verifyAuth(request);
  if (!user || user.role !== "admin") {
    return errorResponse("Only admin can manage company asset status.", 403);
  }

  try {
    const body = await request.json();
    const { id, action } = body;
    if (!id) return errorResponse("Asset ID is required.", 400);

    const assets = await getCompanyAssets(env);
    const asset = assets.find(a => a.id === Number(id));
    if (!asset) return errorResponse("Asset not found.", 404);

    const previousUserId = asset.user_id;

    if (action === "return" || !action) {
      asset.status = "available";
      asset.user_id = null;
      asset.returned_date = new Date().toISOString();
    } else if (action === "retire") {
      asset.status = "retired";
    }

    await saveCompanyAsset(env, asset);

    await recordAudit(env, {
      entity_type: "asset",
      entity_id: asset.id,
      action_by_user_id: user.id,
      assigned_to_user_id: previousUserId,
      action_description_en: `Admin marked company asset '${asset.asset_name}' (${asset.asset_code}) returned back to store.`,
      action_description_hi: `एडमिन ने कंपनी एसेट '${asset.asset_name}' (${asset.asset_code}) को स्टोर में वापस जमा दर्ज किया।`,
    });

    return jsonResponse({ success: true, asset, message: "Asset marked returned successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
