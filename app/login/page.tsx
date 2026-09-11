"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const supabase = createClient();

    // 第一步：使用邮箱和密码登录
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("登录失败：" + error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setMessage("登录失败：没有获取到用户信息");
      setLoading(false);
      return;
    }

    // 第二步：读取当前用户自己的资料
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("real_name, role, approval_status")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      setMessage("登录成功，但读取用户资料失败：" + profileError.message);
      setLoading(false);
      return;
    }

    // 第三步：根据审核状态和角色决定去哪里
    if (profile.approval_status === "pending") {
      router.push("/pending");
      return;
    }

    if (profile.approval_status === "approved") {
      if (profile.role === "admin") {
        router.push("/admin");
        return;
      }

      router.push("/dashboard");
      return;
    }

    if (profile.approval_status === "rejected") {
      setMessage(`你好，${profile.real_name}。你的注册申请未通过。`);
      setLoading(false);
      return;
    }

    setMessage(
      `登录成功，但账号状态未知。当前状态值：${profile.approval_status}`
    );
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-3xl font-bold text-black">
          登录班费小管家
        </h1>

        <p className="mb-8 text-center text-gray-600">
          使用注册时的邮箱和密码登录
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-700">
              邮箱
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              placeholder="请输入邮箱"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700">
              密码
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              placeholder="请输入密码"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-3 text-white disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm text-gray-700">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}