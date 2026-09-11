"use client";

import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [realName, setRealName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          realName,
          email,
          password,
          inviteCode,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(
          result.message || "注册失败，请稍后重试。"
        );
        return;
      }

      setMessage(
        result.message ||
          "注册成功，账号正在等待管理员审核。"
      );

      setRealName("");
      setEmail("");
      setPassword("");
      setInviteCode("");
    } catch (error) {
      console.error("注册过程发生错误：", error);

      setMessage(
        "注册过程中发生错误，请稍后重试。"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-3xl font-bold text-black">
          注册班费小管家
        </h1>

        <p className="mb-8 text-center text-gray-600">
          请输入班级邀请码，注册后需要等待管理员审核
        </p>

        <form
          onSubmit={handleRegister}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm text-gray-700">
              真实姓名
            </label>

            <input
              type="text"
              value={realName}
              onChange={(event) =>
                setRealName(event.target.value)
              }
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              placeholder="请输入真实姓名"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700">
              邮箱
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
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
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              placeholder="至少 6 位密码"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700">
              班级邀请码
            </label>

            <input
              type="password"
              value={inviteCode}
              onChange={(event) =>
                setInviteCode(event.target.value)
              }
              required
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              placeholder="请输入班级邀请码"
            />

            <p className="mt-1 text-xs text-gray-500">
              邀请码请向班级管理员获取
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-3 text-white disabled:opacity-50"
          >
            {loading
              ? "正在注册..."
              : "注册"}
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