import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    // 개발 환경에서는 하드코딩된 비밀번호 사용
    const adminPassword = '92130';
    
    if (password === adminPassword) {
      return NextResponse.json({ 
        success: true 
      });
    }
    
    return NextResponse.json({ 
      success: false,
      message: '비밀번호가 올바르지 않습니다.'
    }, { 
      status: 401 
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ 
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { 
      status: 500 
    });
  }
} 