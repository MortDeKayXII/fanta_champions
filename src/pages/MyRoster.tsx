import RosterEditor from '../components/RosterEditor'
import { Loading } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function MyRoster() {
  const { profile } = useAuth()
  if (!profile) return <Loading />
  return (
    <RosterEditor
      teamId={profile.team_id}
      title="La mia rosa"
      subtitle="Modifica la tua rosa dopo uno scambio. Le formazioni già calcolate non cambiano."
    />
  )
}
