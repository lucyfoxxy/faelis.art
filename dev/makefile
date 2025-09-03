DEV_HOST ?= /var/www/dev.faelis.art/public
APACHE_SITE=dev.faelis.art
APACHE_SRC=deploy/apache/dev.faelis.art.conf
APACHE_DST=/etc/apache2/sites-available/$(APACHE_SITE).conf

.PHONY: dev build deploy fetch clean-build apache-include apache-copy apache-reload
dev:        ; cd app && npm run dev
build:      ; cd app && npm ci && npm run build
deploy:     ; cd app && npm run fetch && npm run build && echo 'Deploying to /var/www/dev.faelis.art/public/...' && sudo rsync -a --delete dist/ /var/www/dev.faelis.art/public/ && echo 'done.'
fetch:		; cd app && npm run fetch 
clean-build: ; cd app && rm -rf node_modules package-lock.json && npm install && npm ci && npm run fetch && npm run build

apache-include:
	@echo 'IncludeOptional '$(abspath $(APACHE_SRC)) | sudo tee $(APACHE_DST) >/dev/null
	sudo a2ensite $(APACHE_SITE) || true
	sudo apachectl configtest && sudo systemctl reload apache2

apache-copy:
	sudo install -m 0644 $(APACHE_SRC) $(APACHE_DST)
	sudo a2ensite $(APACHE_SITE) || true
	sudo apachectl configtest && sudo systemctl reload apache2

apache-reload:
	sudo apachectl configtest && sudo systemctl reload apache2
