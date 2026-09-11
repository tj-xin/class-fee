"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const [message, setMessage] = useState("还没有测试");

  async function testConnection() {
    const supabase = createClient();

    const { error } = await supabase.auth.getSession();

    if (error) {
      setMessage("❌ 连接失败：" + error.message);
    } else {
      setMessage("✅ Supabase 连接成功！");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-black mb-4">班费小管家</h1>

        <p className="text-gray-600 mb-8">
          一个简单的班级收费与缴费管理网站
        </p>

        <button
          onClick={testConnection}
          className="w-full rounded-lg bg-black text-white py-3 mb-4"
        >
          测试 Supabase 连接
        </button>

        <p className="text-gray-700">{message}</p>
      </div>
    </main>
  );
}