import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login({ error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-center text-base">Báo cáo Quản lý</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-zinc-500">Đăng nhập để xem báo cáo</p>
          <div id="g-btn" />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
