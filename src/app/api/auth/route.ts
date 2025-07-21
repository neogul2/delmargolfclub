import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // 서버 사이드에서만 접근 가능한 환경 변수 (NEXT_PUBLIC_ 없음)
    const adminPassword = process.env.ADMIN_PASSWORD || '92130';
    
    if (password === adminPassword) {
      // 간단한 토큰 생성 (실제 프로덕션에서는 JWT 등 사용)
      const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
      
      return NextResponse.json({ 
        success: true, 
        token 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: '비밀번호가 올바르지 않습니다.' 
      }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 