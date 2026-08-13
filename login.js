const form = document.querySelector("#loginForm");
const button = document.querySelector("#loginButton");
const error = document.querySelector("#loginError");
const buttonLabel = button.querySelector("span");
const usernameField = document.querySelector("#usernameField");
const usernameInput = usernameField.querySelector("input");
const passwordField = document.querySelector("#passwordField");
const passwordInput = passwordField.querySelector("input");
const confirmPasswordField = document.querySelector("#confirmPasswordField");
const confirmPasswordInput = confirmPasswordField.querySelector("input");
const emailField = document.querySelector("#emailField");
const emailInput = emailField.querySelector("input");
const emailCodeField = document.querySelector("#emailCodeField");
const emailCodeInput = emailCodeField.querySelector("input");
const sendEmailCodeButton = document.querySelector("#sendEmailCode");
const authTitle = document.querySelector("#authTitle");
const authDescription = document.querySelector("#authDescription");
let authMode = "login";
let emailCodeTimer = 0;
let emailRegisterRequired = false;
const params = new URLSearchParams(window.location.search);
const requestedAuthMode = window.location.pathname.includes("/register") || params.get("mode") === "register" ? "register" : params.get("mode") === "reset" ? "reset" : "login";
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("X-Client-Type")) headers.set("X-Client-Type", "web");
  return nativeFetch(input, { ...init, headers });
};

fetch("./api-snapshots/auth-config.json")
  .then((response) => response.json())
  .then((config) => {
    emailRegisterRequired = Boolean(config.emailRegisterRequired);
    applyAuthMode(requestedAuthMode);
    if (config.registrationEnabled) return;
    const registerTab = document.querySelector('[data-auth-mode="register"]');
    registerTab.disabled = true;
    registerTab.textContent = "注册待开放";
    registerTab.title = "接入 HTTPS 后开放注册";
    if (requestedAuthMode === "register") applyAuthMode("login");
  })
  .catch(() => {});

function applyAuthMode(mode) {
  authMode = mode === "register" ? "register" : mode === "reset" ? "reset" : "login";
  document.querySelectorAll("[data-auth-mode]").forEach((item) => {
    const active = item.dataset.authMode === authMode;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  const registering = authMode === "register";
  const resetting = authMode === "reset";
  usernameField.hidden = resetting;
  usernameInput.required = !resetting;
  usernameInput.type = "email";
  usernameInput.autocomplete = "email";
  usernameInput.placeholder = "请输入邮箱";
  passwordField.hidden = false;
  passwordInput.required = true;
  passwordInput.autocomplete = registering || resetting ? "new-password" : "current-password";
  passwordInput.placeholder = resetting ? "请输入新密码" : "请输入密码";
  confirmPasswordField.hidden = !registering;
  confirmPasswordInput.required = registering || resetting;
  const registerNeedsEmail = registering && emailRegisterRequired;
  emailField.hidden = !(resetting || registerNeedsEmail);
  emailInput.required = resetting || registerNeedsEmail;
  emailInput.placeholder = registering ? "用于注册验证和找回密码" : "请输入已绑定邮箱";
  emailCodeField.hidden = !(resetting || registerNeedsEmail);
  emailCodeInput.required = resetting || registerNeedsEmail;
  if (resetting) {
    confirmPasswordField.hidden = false;
    authTitle.textContent = "找回访问密码";
    authDescription.textContent = "通过已绑定邮箱验证身份，然后设置新的登录密码。";
    buttonLabel.textContent = "重置密码";
  } else {
    authTitle.textContent = registering ? "创建专属机库" : "进入收藏机库";
    authDescription.textContent = registering
      ? "注册后将获得独立资料库，你的收藏记录只属于当前账号。"
      : "登录后继续管理你的收藏记录、预定计划与补款提醒。";
    buttonLabel.textContent = registering ? "建立账号" : "授权进入";
  }
  error.hidden = true;
}

document.querySelectorAll("[data-auth-mode]").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.disabled) return;
    applyAuthMode(tab.dataset.authMode);
  });
});

applyAuthMode(requestedAuthMode);

function setEmailCodeCooldown(seconds) {
  window.clearInterval(emailCodeTimer);
  let left = Number(seconds || 60);
  sendEmailCodeButton.disabled = true;
  sendEmailCodeButton.textContent = `${left}s`;
  emailCodeTimer = window.setInterval(() => {
    left -= 1;
    if (left <= 0) {
      window.clearInterval(emailCodeTimer);
      sendEmailCodeButton.disabled = false;
      sendEmailCodeButton.textContent = "发送验证码";
      return;
    }
    sendEmailCodeButton.textContent = `${left}s`;
  }, 1000);
}

sendEmailCodeButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const scene = authMode === "register" ? "register_email" : "reset_password";
  error.hidden = true;
  sendEmailCodeButton.disabled = true;
  sendEmailCodeButton.textContent = "发送中";
  try {
    const response = await fetch("./api/auth/email/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, scene }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "验证码发送失败");
    if (result.devCode) emailCodeInput.value = result.devCode;
    error.textContent = `验证码已发送到 ${result.emailMasked || "邮箱"}`;
    error.hidden = false;
    setEmailCodeCooldown(60);
  } catch (sendError) {
    error.textContent = sendError.message || "验证码发送失败";
    error.hidden = false;
    sendEmailCodeButton.disabled = false;
    sendEmailCodeButton.textContent = "发送验证码";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  button.disabled = true;
  buttonLabel.textContent = authMode === "register" ? "正在建立" : authMode === "reset" ? "正在重置" : "正在验证";
  error.hidden = true;
  try {
    if (!window.WanwuCloud?.configured) throw new Error("Supabase 尚未配置，请先完成云端设置");
    const email = String(data.get("username") || data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (authMode === "login") {
      await window.WanwuCloud.signIn(email, password);
      window.location.href = "./app/";
      return;
    }
    if (authMode === "register") {
      if (password !== String(data.get("confirmPassword") || "")) throw new Error("两次输入的密码不一致");
      await window.WanwuCloud.signUp(email, password, email.split("@")[0]);
      error.textContent = "注册成功；如果启用了邮箱确认，请先查收验证邮件";
      error.hidden = false;
      button.disabled = false;
      buttonLabel.textContent = "建立账号";
      return;
    }
    if (authMode === "reset") {
      const hasRecoverySession = window.location.hash.includes("access_token") || (await window.WanwuCloud.session()).authenticated;
      if (hasRecoverySession && password) {
        if (password !== String(data.get("confirmPassword") || "")) throw new Error("两次输入的密码不一致");
        await window.WanwuCloud.updatePassword(password);
        applyAuthMode("login");
        error.textContent = "密码已重置，请重新登录";
      } else {
        await window.WanwuCloud.resetPassword(String(data.get("email") || "").trim());
        error.textContent = "重置邮件已发送，请查收邮箱";
      }
      error.hidden = false;
      button.disabled = false;
      buttonLabel.textContent = "重置密码";
      return;
    }
    const endpoint = authMode === "reset" ? "./api/auth/password/reset" : `./api/auth/${authMode}`;
    const payload =
      authMode === "reset"
        ? {
            email: data.get("email").trim(),
            code: data.get("code").trim(),
            password: data.get("password"),
            confirmPassword: data.get("confirmPassword"),
          }
        : {
            username: data.get("username").trim(),
            email: emailRegisterRequired ? data.get("email").trim() : "",
            code: emailRegisterRequired ? data.get("code").trim() : "",
            password: data.get("password"),
            confirmPassword: data.get("confirmPassword"),
          };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "请求失败，请稍后重试");
    if (authMode === "reset") {
      form.reset();
      button.disabled = false;
      applyAuthMode("login");
      error.textContent = "密码已重置，请使用新密码登录";
      error.hidden = false;
      return;
    }
    window.location.href = nextPath;
  } catch (loginError) {
    error.textContent = loginError.message || "登录失败，请稍后重试";
    error.hidden = false;
    button.disabled = false;
    buttonLabel.textContent = authMode === "register" ? "建立账号" : authMode === "reset" ? "重置密码" : "授权进入";
  }
});
