(function initWanwuSupabase() {
  const config = window.WANWU_SUPABASE || {};
  const sdk = window.supabase;
  const configured = Boolean(config.url && config.anonKey && sdk?.createClient);
  const client = configured
    ? sdk.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  function requireClient() {
    if (!client) throw new Error("Supabase 尚未配置，请先填写 supabase-config.js");
    return client;
  }

  function profile(user) {
    const label = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "收藏玩家";
    return {
      id: user.id,
      username: label,
      nickname: user?.user_metadata?.display_name || "",
      avatarUrl: user?.user_metadata?.avatar_url || "",
      isAdmin: false,
      emailBound: Boolean(user.email),
      emailMasked: user.email ? user.email.replace(/^(.{2}).*(@.*)$/, "$1***$2") : "",
      needsPhoneBinding: false,
    };
  }

  async function session() {
    if (!client) return { authenticated: false, user: null, configured: false };
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const user = data.session?.user;
    return { authenticated: Boolean(user), user: user ? profile(user) : null, configured: true };
  }

  async function signIn(email, password) {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password, displayName = "") {
    const { data, error } = await requireClient().auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split("@")[0] } },
    });
    if (error) throw error;
    return data;
  }

  async function resetPassword(email) {
    const redirectTo = new URL("./login/?mode=reset", document.baseURI).href;
    const { data, error } = await requireClient().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  }

  async function updatePassword(password) {
    const { data, error } = await requireClient().auth.updateUser({ password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function loadCollection() {
    const { data: auth, error: authError } = await requireClient().auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("请先登录");
    const { data, error } = await client
      .from("collections")
      .select("records, version, updated_at")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) throw error;
    return { records: Array.isArray(data?.records) ? data.records : [], version: Number(data?.version || 0) };
  }

  async function saveCollection(records, expectedVersion = 0) {
    const { data, error } = await requireClient().rpc("save_collection", {
      new_records: records,
      expected_version: expectedVersion,
    });
    if (error) {
      const conflict = /collection_version_conflict/i.test(error.message || "");
      if (conflict) {
        const latest = await loadCollection();
        const wrapped = new Error("云端数据已在其他设备更新");
        wrapped.statusCode = 409;
        wrapped.data = latest;
        throw wrapped;
      }
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { records: row?.records || records, version: Number(row?.version ?? expectedVersion + 1) };
  }

  async function uploadImage(dataUrl) {
    const { data: auth, error: authError } = await requireClient().auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("请先登录");
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl || "");
    if (!match) throw new Error("图片格式无效");
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    const extension = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
    const name = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
    const bucket = config.storageBucket || "collection-images";
    const { error } = await client.storage.from(bucket).upload(name, bytes, {
      contentType: match[1],
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = client.storage.from(bucket).getPublicUrl(name);
    return { imageUrl: data.publicUrl, storagePath: name };
  }

  async function deleteImage(storagePath) {
    if (!storagePath) return;
    const { error } = await requireClient().storage
      .from(config.storageBucket || "collection-images")
      .remove([storagePath]);
    if (error) throw error;
  }

  window.WanwuCloud = {
    configured,
    client,
    session,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    loadCollection,
    saveCollection,
    uploadImage,
    deleteImage,
  };
})();
