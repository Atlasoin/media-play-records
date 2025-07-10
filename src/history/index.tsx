import React from "react";
import { createRoot } from "react-dom/client";
import History from "../components/History";

// 获取根元素
const container = document.getElementById("root");
if (!container) {
    throw new Error("Root element not found");
}

const root = createRoot(container);

// 渲染 History 组件
root.render(
    <React.StrictMode>
        <History
            onBack={() => {
                // 返回上一页或关闭标签页
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.close();
                }
            }}
        />
    </React.StrictMode>
);
