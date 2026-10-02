import { Card, Notice, PageTitle } from '../components/ui'

export default function Bracket() {
  return (
    <div>
      <PageTitle sub="Le prime 8 saltano i playoff, dalla 9ª alla 24ª giocano i playoff, dalla 25ª in poi sono eliminate.">
        Tabellone
      </PageTitle>
      <Card>
        <Notice>
          Il tabellone sarà disponibile al termine della fase a gironi, quando la classifica sarà
          definitiva.
        </Notice>
      </Card>
    </div>
  )
}
