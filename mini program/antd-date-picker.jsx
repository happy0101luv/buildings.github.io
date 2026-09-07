import React, { useState } from "react";
import { ConfigProvider, DatePicker } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

dayjs.locale("zh-cn");

const roots = new Map();

function parseValue(value, picker) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (picker === "quarter") {
    const match = raw.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return null;
    return dayjs(`${match[1]}-${String((Number(match[2]) - 1) * 3 + 1).padStart(2, "0")}-01`);
  }
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed : null;
}

function storageValue(value, picker) {
  if (!value) return "";
  if (picker === "quarter") return `${value.year()}-Q${Math.floor(value.month() / 3) + 1}`;
  return value.format("YYYY-MM-DD");
}

function PickerIsland({ host }) {
  const picker = host.dataset.picker === "quarter" ? "quarter" : "date";
  const inputName = host.dataset.inputName || "date";
  const hiddenInput = host.parentElement?.querySelector(`input[type="hidden"][name="${inputName}"]`);
  const [value, setValue] = useState(() => parseValue(hiddenInput?.value || host.dataset.value, picker));
  const allowClear = host.dataset.allowClear !== "false";

  const onChange = (nextValue) => {
    setValue(nextValue);
    if (!hiddenInput) return;
    hiddenInput.value = storageValue(nextValue, picker);
    hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#c9272d",
          borderRadius: 6,
          controlHeight: 48,
          fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        components: {
          DatePicker: {
            cellHeight: 24,
            cellWidth: 36,
            textHeight: 40,
            withoutTimeCellHeight: 66,
          },
        },
      }}
    >
      <DatePicker
        allowClear={allowClear}
        className="wanwu-ant-date-picker"
        format={picker === "quarter" ? "YYYY-[Q]Q" : "YYYY/MM/DD"}
        getPopupContainer={() => document.body}
        inputReadOnly
        onChange={onChange}
        picker={picker}
        placeholder={host.dataset.placeholder || (picker === "quarter" ? "选择季度" : "选择日期")}
        value={value}
      />
    </ConfigProvider>
  );
}

function unmountDisconnected() {
  for (const [host, root] of roots) {
    if (host.isConnected) continue;
    root.unmount();
    roots.delete(host);
  }
}

function mountAll(scope = document) {
  unmountDisconnected();
  scope.querySelectorAll("[data-antd-date-picker]").forEach((host) => {
    if (roots.has(host)) return;
    const root = createRoot(host);
    roots.set(host, root);
    flushSync(() => root.render(<PickerIsland host={host} />));
  });
}

function unmountAll(scope = document) {
  for (const [host, root] of roots) {
    if (host !== scope && !scope.contains(host)) continue;
    root.unmount();
    roots.delete(host);
  }
}

window.WanwuAntDatePicker = Object.freeze({ mountAll, unmountAll });
