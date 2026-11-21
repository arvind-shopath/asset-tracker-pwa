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
    return errorResponse("Only admin can assign company assets.", 403);
  }

  try {
    const body = await request.json();
    const { user_id, asset_name, asset_code } = body;

    if (!user_id || !asset_name) {
      return errorResponse("User ID and asset name are required.", 400);
    }

    const users = await getUsers(env);
    const assignedUser = users.find(u => u.id === Number(user_id));
    if (!assignedUser) return errorResponse("User not found.", 404);

    const newAsset = {
      id: Date.now(),
      user_id: Number(user_id),
      asset_name: String(asset_name).trim(),
      asset_code: asset_code ? String(asset_code).trim() : `AST-${Date.now().toString().slice(-4)}`,
      status: "active",
      assigned_date: new Date().toISOString(),
    };

    await saveCompanyAsset(env, newAsset);

    await recordAudit(env, {
      entity_type: "asset",
      entity_id: newAsset.id,
      action_by_user_id: user.id,
      assigned_to_user_id: assignedUser.id,
      action_description_en: `Admin assigned company asset '${newAsset.asset_name}' (${newAsset.asset_code}) to ${assignedUser.name}.`,
      action_description_hi: `एडमिन ने कंपनी एसेट '${newAsset.asset_name}' (${newAsset.asset_code}) ${assignedUser.name} को जारी किया।`,
    });

    return jsonResponse({ success: true, asset: newAsset, message: "Asset assigned successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const user = await verifyAuth(request);
  if (!user || user.role !== "admin") {
    return errorResponse("Only admin can mark company assets returned.", 403);
  }

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return errorResponse("Asset ID is required.", 400);

    const assets = await getCompanyAssets(env);
    const asset = assets.find(a => a.id === Number(id));
    if (!asset) return errorResponse("Asset not found.", 404);

    asset.status = "returned";
    await saveCompanyAsset(env, asset);

    return jsonResponse({ success: true, asset, message: "Asset marked returned successfully." });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
