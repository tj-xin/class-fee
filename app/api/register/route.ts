import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const realName = body.realName;
    const email = body.email;
    const password = body.password;
    const inviteCode = body.inviteCode;

    if (
      typeof realName !== "string" ||
      realName.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "请输入真实姓名。",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof email !== "string" ||
      email.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "请输入邮箱。",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof password !== "string" ||
      password.length < 6
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "密码至少需要 6 位。",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof inviteCode !== "string" ||
      inviteCode.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "请输入班级邀请码。",
        },
        {
          status: 400,
        }
      );
    }

    const correctInviteCode =
      process.env.CLASS_INVITE_CODE;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (
      !correctInviteCode ||
      !supabaseUrl ||
      !supabaseSecretKey
    ) {
      console.error(
        "服务器注册环境变量配置不完整"
      );

      return NextResponse.json(
        {
          success: false,
          message: "服务器配置异常，请联系管理员。",
        },
        {
          status: 500,
        }
      );
    }

    if (inviteCode !== correctInviteCode) {
      return NextResponse.json(
        {
          success: false,
          message: "班级邀请码不正确。",
        },
        {
          status: 403,
        }
      );
    }

    // 这个 Supabase 客户端只存在于服务器。
    // Secret Key 绝不能放进浏览器代码。
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 由服务器创建 Auth 用户。
    const {
      data: userData,
      error: createUserError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
      });

    if (
      createUserError ||
      !userData.user
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "创建账号失败：" +
            (
              createUserError?.message ??
              "未知错误"
            ),
        },
        {
          status: 400,
        }
      );
    }

    // 创建对应的 profiles 资料。
    const { error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .insert({
          id: userData.user.id,
          real_name: realName.trim(),
          role: "student",
          approval_status: "pending",
        });

    if (profileError) {
      // 如果 Auth 用户建好了，但 profile 创建失败，
      // 为了避免留下“半个账号”，把 Auth 用户删掉。
      await supabaseAdmin.auth.admin.deleteUser(
        userData.user.id
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "创建学生资料失败：" +
            profileError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "注册成功，账号正在等待管理员审核。",
    });
  } catch (error) {
    console.error("服务器注册失败：", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "注册过程中发生错误，请稍后重试。",
      },
      {
        status: 500,
      }
    );
  }
}