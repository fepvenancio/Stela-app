import { redirect } from 'next/navigation'

export default function BorrowPage() {
  redirect('/trade?mode=advanced')
}
