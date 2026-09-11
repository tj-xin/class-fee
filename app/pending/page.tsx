export default function PendingPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="mb-4 text-3xl font-bold text-black">
          等待管理员审核
        </h1>

        <p className="text-gray-600">
          你的注册信息已经提交，请等待管理员审核通过后再使用班费系统。
        </p>
      </div>
    </main>
  );
}