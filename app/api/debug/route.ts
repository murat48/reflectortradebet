import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, data } = await request.json()
    
    console.log('🔧 DEBUG API:', message)
    if (data) {
      console.log('🔧 DEBUG DATA:', JSON.stringify(data, null, 2))
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ DEBUG API Error:', error)
    return NextResponse.json({ success: false, error: 'Debug API failed' }, { status: 500 })
  }
}
