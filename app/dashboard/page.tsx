"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Profile = {
  id: string;
  real_name: string;
  role: string;
  approval_status: string;
};

type FeeItem = {
  id: string;
  title: string;
  amount: number;
  description: string | null;
  due_date: string | null;
};

type Payment = {
  id: string;
  fee_item_id: string;
  status: string;
  submitted_at: string | null;
  confirmed_at: string | null;
};

type PaymentMethod = "wechat" | "alipay";

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // 缴费弹窗相关状态
  const [selectedFeeItem, setSelectedFeeItem] =
    useState<FeeItem | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("wechat");

  const [wechatQrUrl, setWechatQrUrl] = useState("");
  const [alipayQrUrl, setAlipayQrUrl] = useState("");

  const [qrLoading, setQrLoading] = useState(false);
  const [submittingPayment, setSubmittingPayment] =
    useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();

      // 1. 检查是否已经登录
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      // 2. 读取当前用户自己的资料
      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            "id, real_name, role, approval_status"
          )
          .eq("id", user.id)
          .single();

      if (profileError) {
        setMessage(
          "读取用户资料失败：" +
            profileError.message
        );
        setLoading(false);
        return;
      }

      // 3. 根据审核状态决定能不能进入
      if (
        profileData.approval_status === "pending"
      ) {
        router.push("/pending");
        return;
      }

      if (
        profileData.approval_status !== "approved"
      ) {
        setMessage(
          "你的账号暂时无法使用，请联系管理员。"
        );
        setLoading(false);
        return;
      }

      // 4. 管理员不进入学生页面
      if (profileData.role === "admin") {
        router.push("/admin");
        return;
      }

      setProfile(profileData);

      // 5. 读取所有收费项目
      const { data: feeData, error: feeError } =
        await supabase
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

      // 6. 读取当前学生自己的缴费记录
      const {
        data: paymentData,
        error: paymentError,
      } = await supabase
        .from("payments")
        .select(
          "id, fee_item_id, status, submitted_at, confirmed_at"
        )
        .order("submitted_at", { ascending: false });

      if (paymentError) {
        setMessage(
          "读取缴费记录失败：" +
            paymentError.message
        );
        setLoading(false);
        return;
      }

      setFeeItems(feeData ?? []);
      setPayments(paymentData ?? []);
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  function getPayment(feeItemId: string) {
    return payments.find(
      (payment) =>
        payment.fee_item_id === feeItemId
    );
  }

  async function openPaymentModal(
    feeItem: FeeItem
  ) {
    setSelectedFeeItem(feeItem);
    setPaymentMethod("wechat");
    setMessage("");

    setQrLoading(true);

    const supabase = createClient();

    // 每次打开弹窗都重新生成 Signed URL。
    // Signed URL 只有 10 分钟有效期，
    // 这样可以避免页面开太久后二维码失效。
    const {
      data: wechatData,
      error: wechatError,
    } = await supabase.storage
      .from("payment-qrcodes")
      .createSignedUrl("wechat.jpg", 600);

    const {
      data: alipayData,
      error: alipayError,
    } = await supabase.storage
      .from("payment-qrcodes")
      .createSignedUrl("alipay.jpg", 600);

    if (wechatError || alipayError) {
      console.error(
        "微信二维码错误：",
        wechatError
      );

      console.error(
        "支付宝二维码错误：",
        alipayError
      );

      setMessage(
        "收款二维码加载失败，请稍后重试。"
      );

      setQrLoading(false);
      return;
    }

    setWechatQrUrl(wechatData.signedUrl);
    setAlipayQrUrl(alipayData.signedUrl);

    setQrLoading(false);
  }

  function closePaymentModal() {
    if (submittingPayment) {
      return;
    }

    setSelectedFeeItem(null);
  }

  async function submitPayment() {
    if (!selectedFeeItem) {
      return;
    }

    setSubmittingPayment(true);
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSubmittingPayment(false);
      router.push("/login");
      return;
    }

    // 看看这个收费项目以前有没有缴费记录
    const existingPayment = getPayment(
      selectedFeeItem.id
    );

    // 情况一：
    // 以前被管理员拒绝过。
    // 不创建新记录，而是调用数据库函数，
    // 把原来的 rejected 安全地改回 pending。
    if (existingPayment?.status === "rejected") {
      const { error: resubmitError } =
        await supabase.rpc(
          "resubmit_rejected_payment",
          {
            target_payment_id:
              existingPayment.id,
          }
        );

      if (resubmitError) {
        setMessage(
          "重新提交缴费失败：" +
            resubmitError.message
        );
        setSubmittingPayment(false);
        return;
      }

      setPayments((currentPayments) =>
        currentPayments.map((payment) =>
          payment.id === existingPayment.id
            ? {
                ...payment,
                status: "pending",
                submitted_at: new Date().toISOString(),
                confirmed_at: null,
              }
            : payment
        )
      );

      setSubmittingPayment(false);
      setSelectedFeeItem(null);
      setMessage(
        "已重新提交缴费记录，请等待管理员确认。"
      );
      return;
    }

    // 情况二：
    // 第一次缴费，没有任何旧记录。
    if (!existingPayment) {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          fee_item_id: selectedFeeItem.id,
          status: "pending",
        })
        .select(
          "id, fee_item_id, status, submitted_at, confirmed_at"
        )
        .single();

      if (error) {
        setMessage(
          "提交缴费记录失败：" +
            error.message
        );
        setSubmittingPayment(false);
        return;
      }

      setPayments((currentPayments) => [
        ...currentPayments,
        data,
      ]);

      setSubmittingPayment(false);
      setSelectedFeeItem(null);
      setMessage(
        "缴费记录已提交，请等待管理员确认。"
      );
      return;
    }

    // 理论上正常页面不会走到这里。
    // 防止 pending / paid 状态被重复提交。
    setMessage(
      "这项班费已经有缴费记录，不能重复提交。"
    );
    setSubmittingPayment(false);
    setSelectedFeeItem(null);
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
  }

  function getFeeItem(feeItemId: string) {
    return feeItems.find(
      (item) => item.id === feeItemId
    );
  }

  function formatDateTime(dateTime: string | null) {
    if (!dateTime) {
      return "—";
    }

    return new Date(dateTime).toLocaleString("zh-CN");
  }

  function getPaymentStatusText(status: string) {
    if (status === "paid") {
      return "已确认";
    }

    if (status === "pending") {
      return "待确认";
    }

    if (status === "rejected") {
      return "未通过";
    }

    return "未知状态";
  }

  const totalAmount = feeItems.reduce(
    (sum, item) =>
      sum + Number(item.amount),
    0
  );

  const paidAmount = feeItems.reduce(
    (sum, item) => {
      const payment = getPayment(item.id);

      if (payment?.status === "paid") {
        return sum + Number(item.amount);
      }

      return sum;
    },
    0
  );

  const pendingAmount = feeItems.reduce(
    (sum, item) => {
      const payment = getPayment(item.id);

      if (payment?.status === "pending") {
        return sum + Number(item.amount);
      }

      return sum;
    },
    0
  );

  const unpaidAmount =
    totalAmount - paidAmount - pendingAmount;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600">
          正在加载班费信息...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-black">
              班费小管家
            </h1>

            <p className="mt-2 text-gray-600">
              你好，{profile?.real_name}
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

        {/* 统计卡片 */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              应缴班费
            </p>

            <p className="mt-2 text-3xl font-bold text-black">
              ¥{totalAmount.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              已确认缴费
            </p>

            <p className="mt-2 text-3xl font-bold text-black">
              ¥{paidAmount.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              待管理员确认
            </p>

            <p className="mt-2 text-3xl font-bold text-black">
              ¥{pendingAmount.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              尚未缴费
            </p>

            <p className="mt-2 text-3xl font-bold text-black">
              ¥{unpaidAmount.toFixed(2)}
            </p>
          </div>
        </section>

        {/* 收费项目 */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-black">
            收费项目
          </h2>

          {feeItems.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-gray-500">
                暂时没有收费项目。
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {feeItems.map((item) => {
                const payment =
                  getPayment(item.id);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-black">
                          {item.title}
                        </h3>

                        <p className="mt-2 text-2xl font-bold text-black">
                          ¥
                          {Number(
                            item.amount
                          ).toFixed(2)}
                        </p>

                        {item.description && (
                          <p className="mt-2 text-sm text-gray-600">
                            {item.description}
                          </p>
                        )}

                        {item.due_date && (
                          <p className="mt-2 text-sm text-gray-500">
                            截止日期：
                            {item.due_date}
                          </p>
                        )}
                      </div>

                      <div>
                        {!payment && (
                          <button
                            onClick={() =>
                              openPaymentModal(
                                item
                              )
                            }
                            className="rounded-lg bg-black px-5 py-3 text-white"
                          >
                            去缴费
                          </button>
                        )}

                        {payment?.status ===
                          "pending" && (
                          <div className="rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                            已提交，等待管理员确认
                          </div>
                        )}

                        {payment?.status ===
                          "paid" && (
                          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                            已确认缴费
                          </div>
                        )}

                        {payment?.status ===
                          "rejected" && (
                          <div className="space-y-3">
                            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                              缴费未通过，请重新缴费
                            </div>

                            <button
                              onClick={() =>
                                openPaymentModal(
                                  item
                                )
                              }
                              className="w-full rounded-lg bg-black px-5 py-3 text-white"
                            >
                              重新缴费
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 我的缴费记录 */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">
            我的缴费记录
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            查看你已经提交过的班费记录和管理员确认状态。
          </p>

          {payments.length === 0 ? (
            <p className="mt-4 text-gray-500">
              暂时没有缴费记录。
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {payments.map((payment) => {
                const feeItem = getFeeItem(
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
                          {feeItem?.title ??
                            "未知收费项目"}
                        </p>

                        <p className="mt-1 text-lg font-bold text-black">
                          ¥
                          {Number(
                            feeItem?.amount ?? 0
                          ).toFixed(2)}
                        </p>

                        <p className="mt-3 text-sm text-gray-500">
                          提交时间：
                          {formatDateTime(
                            payment.submitted_at
                          )}
                        </p>

                        {payment.status === "paid" && (
                          <p className="mt-1 text-sm text-gray-500">
                            确认时间：
                            {formatDateTime(
                              payment.confirmed_at
                            )}
                          </p>
                        )}
                      </div>

                      <div>
                        {payment.status === "paid" && (
                          <span className="inline-block rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700">
                            {getPaymentStatusText(
                              payment.status
                            )}
                          </span>
                        )}

                        {payment.status === "pending" && (
                          <span className="inline-block rounded-lg bg-yellow-100 px-3 py-2 text-sm font-medium text-yellow-800">
                            {getPaymentStatusText(
                              payment.status
                            )}
                          </span>
                        )}

                        {payment.status === "rejected" && (
                          <span className="inline-block rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
                            {getPaymentStatusText(
                              payment.status
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 缴费弹窗 */}
      {selectedFeeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-black">
                  扫码缴费
                </h2>

                <p className="mt-1 text-gray-500">
                  {selectedFeeItem.title}
                </p>
              </div>

              <button
                type="button"
                onClick={closePaymentModal}
                className="text-2xl leading-none text-gray-400"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-500">
                本次应付
              </p>

              <p className="mt-1 text-3xl font-bold text-black">
                ¥
                {Number(
                  selectedFeeItem.amount
                ).toFixed(2)}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setPaymentMethod("wechat")
                }
                className={`rounded-xl border px-4 py-3 ${
                  paymentMethod === "wechat"
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                微信支付
              </button>

              <button
                type="button"
                onClick={() =>
                  setPaymentMethod("alipay")
                }
                className={`rounded-xl border px-4 py-3 ${
                  paymentMethod === "alipay"
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                支付宝
              </button>
            </div>

            <div className="mt-6 text-center">
              {qrLoading ? (
                <div className="flex h-72 items-center justify-center rounded-xl bg-gray-50">
                  <p className="text-gray-500">
                    正在加载收款码...
                  </p>
                </div>
              ) : (
                <>
                  {paymentMethod ===
                    "wechat" &&
                    wechatQrUrl && (
                      <img
                        src={wechatQrUrl}
                        alt="微信收款码"
                        className="mx-auto max-h-80 max-w-full rounded-xl"
                      />
                    )}

                  {paymentMethod ===
                    "alipay" &&
                    alipayQrUrl && (
                      <img
                        src={alipayQrUrl}
                        alt="支付宝收款码"
                        className="mx-auto max-h-80 max-w-full rounded-xl"
                      />
                    )}
                </>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
              请先使用微信或支付宝完成转账。
              确认转账成功后，再点击下面的
              “我已完成转账”。
            </div>

            <button
              type="button"
              onClick={submitPayment}
              disabled={
                submittingPayment || qrLoading
              }
              className="mt-5 w-full rounded-xl bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
            >
              {submittingPayment
                ? "正在提交..."
                : "我已完成转账"}
            </button>

            <button
              type="button"
              onClick={closePaymentModal}
              disabled={submittingPayment}
              className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-gray-700 disabled:opacity-50"
            >
              暂不缴费
            </button>
          </div>
        </div>
      )}
    </main>
  );
}