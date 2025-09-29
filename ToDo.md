# ToDo's 
--------------------------------------------------------------------------
## Renaming
- now only remaining for rename: section,prose,panel -> content-*
- some tokens need renaming to fit introduced naming patterns

## Gallery Detail Page:
- lets reduce the amount of thumbnails displayed below the image frame and introduce a slim thumbnail navigation limited to a maximum of 10 or 12 thumbs displayed simultaneously
  and let it load the next ones dynamically, i think you got my point here. 
- Add translateY on hover to the thumbnail-bar
- add "lightbox" as frame:on-click action, displaying the fullsize version, pausing the auto slide while open
- move the altered thumbnail bar closer to the frame-card (inside the same content card) and add progressbar and prev/next as overlays with reduced opacity. Feel free to recommend me some styles for that.
  basically: make the frame looks more consitent

## Gallery-Frame (both compact + large)
- progress bar as overlay on the frames bottom
- adjust the frame's scaling, especially for the compact version, which should avoid both letterboxing and heavily cutoffs.
  Recommend me some best practices regarding src images, goal would be to find a good balance suitable for a wide range of src image aspect ratios.
- implement smoother image transitions but keep them decent

