import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-12">
        <div className="grid w-full gap-8 rounded-3xl bg-white p-8 shadow-sm md:grid-cols-2 md:p-12">
          <section className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-medium text-gray-500">
              班级收费与缴费管理
            </p>

            <h1 className="mb-4 text-4xl font-bold tracking-tight text-black md:text-5xl">
              班费小管家
            </h1>

            <p className="mb-8 text-base leading-7 text-gray-600">
              一个简单、清晰的班费管理网站。
              学生可以查看收费项目、扫码缴费和查询缴费记录，
              管理员可以审核学生、发布收费项目、确认缴费并查看班费流水。
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-xl bg-black px-6 py-3 text-center font-medium text-white"
              >
                登录
              </Link>

              <Link
                href="/register"
                className="rounded-xl border border-gray-300 px-6 py-3 text-center font-medium text-black"
              >
                注册
              </Link>
            </div>
          </section>

          <section className="rounded-2xl bg-gray-50 p-6">
            <h2 className="mb-5 text-xl font-semibold text-black">
              可以做什么？
            </h2>

            <div className="space-y-5">
              <div>
                <h3 className="font-medium text-black">
                  学生
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  查看班费项目、扫码转账、提交缴费申请，
                  并查看自己的缴费状态和历史记录。
                </p>
              </div>

              <div>
                <h3 className="font-medium text-black">
                  管理员
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  审核新学生、发布收费项目、确认或拒绝缴费，
                  并查看班级缴费情况和班费流水。
                </p>
              </div>

              <div>
                <h3 className="font-medium text-black">
                  安全与权限
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  学生注册需要班级邀请码和管理员审核，
                  不同身份只能访问自己有权限的数据。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}