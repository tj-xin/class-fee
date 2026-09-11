"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Profile = {
  id: string;
  real_name: string;
  role: string;
  approval_status: string;
};

type Payment = {
  id: string;
  user_id: string;
  fee_item_id: string;
  status: string;
  submitted_at: string | null;
  confirmed_at: string | null;
};

type FeeItem = {
  id: string;
  title: string;
  amount: number;
  description: string | null;
  due_date: string | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [currentAdmin, setCurrentAdmin] =
    useState<Profile | null>(null);

  const [profiles, setProfiles] =
    useState<Profile[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [feeItems, setFeeItems] =
    useState<FeeItem[]>([]);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] =
    useState("");
  const [dueDate, setDueDate] = useState("");

  const [loading, setLoading] = useState(true);

  const [creatingFeeItem, setCreatingFeeItem] =
    useState(false);

  const [message, setMessage] = useState("");
  const [actionId, setActionId] = useState("");

  useEffect(() => {
    async function loadAdminData() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const {
        data: adminProfile,
        error: adminProfileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, real_name, role, approval_status"
        )
        .eq("id", user.id)
        .single();

      if (adminProfileError) {
        setMessage(
          "读取管理员资料失败：" +
            adminProfileError.message
        );
        setLoading(false);
        return;
      }

      if (
        adminProfile.role !== "admin" ||
        adminProfile.approval_status !==
          "approved"
      ) {
        router.push("/dashboard");
        return;
      }

      setCurrentAdmin(adminProfile);

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, real_name, role, approval_status"
        )
        .order("created_at", {
          ascending: true,
        });

      if (profileError) {
        setMessage(
          "读取用户资料失败：" +
            profileError.message
        );
        setLoading(false);
        return;
      }

      const {
        data: paymentData,
        error: paymentError,
      } = await supabase
        .from("payments")
        .select(
          "id, user_id, fee_item_id, status, submitted_at, confirmed_at"
        )
        .order("submitted_at", {
          ascending: false,
        });

      if (paymentError) {
        setMessage(
          "读取缴费记录失败：" +
            paymentError.message
        );
        setLoading(false);
        return;
      }

      const {
        data: feeData,
        error: feeError,
      } = await supabase
        .from("fee_items")
        .select(
          "id, title, amount, description, due_date"
        )
        .order("created_at", {
          ascending: false,
        });

      if (feeError) {
        setMessage(
          "读取收费项目失败：" +
            feeError.message
        );
        setLoading(false);
        return;
      }

      setProfiles(profileData ?? []);
      setPayments(paymentData ?? []);
      setFeeItems(feeData ?? []);
      setLoading(false);
    }

    loadAdminData();
  }, [router]);

  async function handleCreateFeeItem(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setCreatingFeeItem(true);
    setMessage("");

    const numericAmount = Number(amount);

    if (!title.trim()) {
      setMessage("请输入收费项目名称。");
      setCreatingFeeItem(false);
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setMessage("请输入正确的收费金额。");
      setCreatingFeeItem(false);
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("fee_items")
      .insert({
        title: title.trim(),
        amount: numericAmount,
        description:
          description.trim() || null,
        due_date: dueDate || null,
      })
      .select(
        "id, title, amount, description, due_date"
      )
      .single();

    if (error) {
      setMessage(
        "发布收费项目失败：" +
          error.message
      );
      setCreatingFeeItem(false);
      return;
    }

    setFeeItems((currentItems) => [
      data,
      ...currentItems,
    ]);

    setTitle("");
    setAmount("");
    setDescription("");
    setDueDate("");
    setCreatingFeeItem(false);
  }

  async function updateApprovalStatus(
    userId: string,
    status: "approved" | "rejected"
  ) {
    setActionId(userId);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: status,
      })
      .eq("id", userId);

    if (error) {
      setMessage(
        "更新审核状态失败：" +
          error.message
      );
      setActionId("");
      return;
    }

    setProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.id === userId
          ? {
              ...profile,
              approval_status: status,
            }
          : profile
      )
    );

    setActionId("");
  }

  async function updatePaymentStatus(
    paymentId: string,
    status: "paid" | "rejected"
  ) {
    setActionId(paymentId);
    setMessage("");

    const supabase = createClient();

    // 确认到账时记录当前时间。
    // 拒绝时把确认时间清空。
    const confirmedAt =
      status === "paid"
        ? new Date().toISOString()
        : null;

    const { error } = await supabase
      .from("payments")
      .update({
        status,
        confirmed_at: confirmedAt,
      })
      .eq("id", paymentId);

    if (error) {
      setMessage(
        "更新缴费状态失败：" +
          error.message
      );
      setActionId("");
      return;
    }

    setPayments((currentPayments) =>
      currentPayments.map((payment) =>
        payment.id === paymentId
          ? {
              ...payment,
              status,
              confirmed_at: confirmedAt,
            }
          : payment
      )
    );

    setActionId("");
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
  }

  function getUserName(userId: string) {
    const user = profiles.find(
      (profile) => profile.id === userId
    );

    return user?.real_name ?? "未知用户";
  }

  function getFeeItem(feeItemId: string) {
    return feeItems.find(
      (item) => item.id === feeItemId
    );
  }

  function getStudentPayment(
    studentId: string,
    feeItemId: string
  ) {
    return payments.find(
      (payment) =>
        payment.user_id === studentId &&
        payment.fee_item_id === feeItemId
    );
  }

  function getPaymentStatusText(
    status?: string
  ) {
    if (status === "paid") {
      return "已确认";
    }

    if (status === "pending") {
      return "待确认";
    }

    if (status === "rejected") {
      return "未通过";
    }

    return "未缴费";
  }

  function formatDateTime(
    dateTime: string | null
  ) {
    if (!dateTime) {
      return "—";
    }

    return new Date(dateTime).toLocaleString(
      "zh-CN"
    );
  }

  const students = profiles.filter(
    (profile) => profile.role === "student"
  );

  const approvedStudents = students.filter(
    (profile) =>
      profile.approval_status === "approved"
  );

  const pendingStudents = students.filter(
    (profile) =>
      profile.approval_status === "pending"
  );

  const pendingPayments = payments.filter(
    (payment) =>
      payment.status === "pending"
  );

  const paidPayments = payments.filter(
    (payment) => payment.status === "paid"
  );

  const confirmedIncome =
    paidPayments.reduce((sum, payment) => {
      const feeItem = getFeeItem(
        payment.fee_item_id
      );

      if (!feeItem) {
        return sum;
      }

      return (
        sum + Number(feeItem.amount)
      );
    }, 0);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600">
          正在加载管理员后台...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-black">
              班费小管家 · 管理员后台
            </h1>

            <p className="mt-2 text-gray-600">
              你好，{currentAdmin?.real_name}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700"
          >
            退出登录
          </button>
        </header>

        {message && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 text-gray-700">
            {message}
          </div>
        )}

        {/* 顶部统计 */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              已审核学生
            </p>

            <p className="mt-2 text-3xl font-bold text-black">
              {approvedStudents.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              待审核学生
            </p>

            <p className="mt-2 text-3xl font-bold text-black">
              {pendingStudents.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              待确认缴费
            </p>

            <p className="mt-2 text-3xl font-bold text-black">
              {pendingPayments.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              已确认收入
            </p>

            <p className="mt-2 text-3xl font-bold text-black">
              ¥{confirmedIncome.toFixed(2)}
            </p>
          </div>
        </section>

        {/* 发布收费项目 */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">
            发布收费项目
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            发布后，已审核学生会在学生主页看到新的收费项目。
          </p>

          <form
            onSubmit={handleCreateFeeItem}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm text-gray-700">
                收费项目名称
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                required
                placeholder="例如：10月班费"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">
                金额（元）
              </label>

              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(
                    event.target.value
                  )
                }
                required
                placeholder="例如：50"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">
                收费说明
              </label>

              <input
                type="text"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="例如：用于班级日常公共支出"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">
                截止日期
              </label>

              <input
                type="date"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-black"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creatingFeeItem}
                className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                {creatingFeeItem
                  ? "正在发布..."
                  : "发布收费项目"}
              </button>
            </div>
          </form>
        </section>

        {/* 已发布收费项目 */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">
            已发布收费项目
          </h2>

          {feeItems.length === 0 ? (
            <p className="mt-4 text-gray-500">
              暂时没有收费项目。
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {feeItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-black">
                        {item.title}
                      </p>

                      {item.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {item.description}
                        </p>
                      )}

                      {item.due_date && (
                        <p className="mt-1 text-sm text-gray-500">
                          截止日期：
                          {item.due_date}
                        </p>
                      )}
                    </div>

                    <p className="text-lg font-bold text-black">
                      ¥
                      {Number(
                        item.amount
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 学生缴费情况 */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">
            学生缴费情况
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            查看每位已审核学生的各项班费缴纳状态。
          </p>

          {approvedStudents.length === 0 ? (
            <p className="mt-4 text-gray-500">
              暂时没有已审核学生。
            </p>
          ) : feeItems.length === 0 ? (
            <p className="mt-4 text-gray-500">
              暂时没有收费项目。
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {approvedStudents.map(
                (student) => (
                  <div
                    key={student.id}
                    className="rounded-xl border border-gray-200 p-5"
                  >
                    <h3 className="text-lg font-bold text-black">
                      {student.real_name}
                    </h3>

                    <div className="mt-4 space-y-3">
                      {feeItems.map(
                        (item) => {
                          const payment =
                            getStudentPayment(
                              student.id,
                              item.id
                            );

                          const statusText =
                            getPaymentStatusText(
                              payment?.status
                            );

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="font-medium text-black">
                                  {item.title}
                                </p>

                                <p className="mt-1 text-sm text-gray-500">
                                  ¥
                                  {Number(
                                    item.amount
                                  ).toFixed(2)}
                                </p>
                              </div>

                              <div>
                                {statusText ===
                                  "已确认" && (
                                  <span className="inline-block rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700">
                                    已确认
                                  </span>
                                )}

                                {statusText ===
                                  "待确认" && (
                                  <span className="inline-block rounded-lg bg-yellow-100 px-3 py-2 text-sm font-medium text-yellow-800">
                                    待确认
                                  </span>
                                )}

                                {statusText ===
                                  "未通过" && (
                                  <span className="inline-block rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
                                    未通过
                                  </span>
                                )}

                                {statusText ===
                                  "未缴费" && (
                                  <span className="inline-block rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
                                    未缴费
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* 待审核学生 */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">
            待审核学生
          </h2>

          {pendingStudents.length === 0 ? (
            <p className="mt-4 text-gray-500">
              暂时没有待审核学生。
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {pendingStudents.map(
                (student) => (
                  <div
                    key={student.id}
                    className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-black">
                        {student.real_name}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        当前状态：等待审核
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          updateApprovalStatus(
                            student.id,
                            "approved"
                          )
                        }
                        disabled={
                          actionId ===
                          student.id
                        }
                        className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
                      >
                        通过
                      </button>

                      <button
                        onClick={() =>
                          updateApprovalStatus(
                            student.id,
                            "rejected"
                          )
                        }
                        disabled={
                          actionId ===
                          student.id
                        }
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 disabled:opacity-50"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* 待确认缴费 */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">
            待确认缴费
          </h2>

          {pendingPayments.length === 0 ? (
            <p className="mt-4 text-gray-500">
              暂时没有待确认缴费。
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {pendingPayments.map(
                (payment) => {
                  const feeItem =
                    getFeeItem(
                      payment.fee_item_id
                    );

                  return (
                    <div
                      key={payment.id}
                      className="rounded-xl border border-gray-200 p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-black">
                            {getUserName(
                              payment.user_id
                            )}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            {feeItem?.title ??
                              "未知收费项目"}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            金额：¥
                            {Number(
                              feeItem?.amount ??
                                0
                            ).toFixed(2)}
                          </p>

                          {payment.submitted_at && (
                            <p className="mt-1 text-sm text-gray-500">
                              提交时间：
                              {formatDateTime(
                                payment.submitted_at
                              )}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updatePaymentStatus(
                                payment.id,
                                "paid"
                              )
                            }
                            disabled={
                              actionId ===
                              payment.id
                            }
                            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
                          >
                            确认到账
                          </button>

                          <button
                            onClick={() =>
                              updatePaymentStatus(
                                payment.id,
                                "rejected"
                              )
                            }
                            disabled={
                              actionId ===
                              payment.id
                            }
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 disabled:opacity-50"
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* 班费流水 */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">
            班费流水
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            按学生提交时间查看所有缴费记录。
          </p>

          {payments.length === 0 ? (
            <p className="mt-4 text-gray-500">
              暂时没有缴费记录。
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {payments.map((payment) => {
                const feeItem =
                  getFeeItem(
                    payment.fee_item_id
                  );

                return (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-black">
                          {getUserName(
                            payment.user_id
                          )}
                        </p>

                        <p className="mt-1 text-gray-700">
                          {feeItem?.title ??
                            "未知收费项目"}
                        </p>

                        <p className="mt-2 text-sm text-gray-500">
                          提交时间：
                          {formatDateTime(
                            payment.submitted_at
                          )}
                        </p>

                        {payment.status ===
                          "paid" && (
                          <p className="mt-1 text-sm text-gray-500">
                            确认时间：
                            {formatDateTime(
                              payment.confirmed_at
                            )}
                          </p>
                        )}
                      </div>

                      <div className="sm:text-right">
                        <p className="text-lg font-bold text-black">
                          ¥
                          {Number(
                            feeItem?.amount ??
                              0
                          ).toFixed(2)}
                        </p>

                        <div className="mt-2">
                          {payment.status ===
                            "paid" && (
                            <span className="inline-block rounded-lg bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                              已确认
                            </span>
                          )}

                          {payment.status ===
                            "pending" && (
                            <span className="inline-block rounded-lg bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                              待确认
                            </span>
                          )}

                          {payment.status ===
                            "rejected" && (
                            <span className="inline-block rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                              未通过
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}