# ToDo's 
--------------------------------------------------------------------------

## General: 
- primary / secondary colors: audit - wo werden sie wie verwendet? + Anpassung ins gesamtbild (weniger aggressiv)
- weiteres CSS Refactoring, obsoletes/redundantes entfernen, styles vereinheitlichen
- meta media links (preview)
- konsolidierung slugs.json + prices.json, global-key: categories
- rename kv -> content-list
- konsolidierung / rename gallery.css -> media.css
- split content.css and import sub-css (maybe)

## Startpage: 
- Contact Buttons: Änderung der hover Schriftfarbe

## Gallery Detail Page:
- nur eine (oder zwei) reihe(n) thumbnails statt alle, dafür rechts und links davon buttons prev/next
- bei click aufs bild lightbox inkl. thumbnail navigation, pause auto slideshow während lightbox offen ist
- thumbnails mit in gallery content card

## Gallery Frame (large)
- player controls mit ins image-frame, (overlay?)

## Gallery-Frame (both compact + large)
- progress mit ins frame (overlay?)
- size soll sich an den verfügbaren parent-container anpassen (um insbesondere auf der startseite leeren platz zu vermeiden) 
- überführung -> aktuell ungenutzte content-media class?

## StartPage
- obsolete "intro" class entfernen aus astro
- intro__hero ggf renaming -> content-media--hero 

## Pricing + Gallery Detail Pages:
- chip restyle: box-shadow/stil wie contact buttons (-> konsolidierung mit diesen und überführung ineinheitliche button class, wobei die chips weiterhin ihre aktuelle größe in etwa beibehalten sollen)

## Site-Nav header
- hover: translate-y wie buttons

