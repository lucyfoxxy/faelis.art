DEV_APP_DIR ?= /srv/faelis.art/dev/app
DEV_DEPLOY_DST ?= /var/www/dev.faelis.art/public
DEV_DEPLOY_SRC ?= $(DEV_APP_DIR)/dist/
APACHE_SITE=dev.faelis.art
APACHE_SRC=deploy/apache/dev.faelis.art.conf
APACHE_DST=/etc/apache2/sites-available/$(APACHE_SITE).conf

.PHONY: dev build deploy fetch clean-build apache-include apache-copy apache-reload
dev:        ; cd $(DEV_APP_DIR) && npm run dev
build:      ; cd $(DEV_APP_DIR) && npm ci && npm run build
fetch-deploy:     ; cd $(DEV_APP_DIR) && npm run fetch && npm run build && echo 'Deploying $(DEV_DEPLOY_SRC) to $(DEV_DEPLOY_DST)' && sudo rsync -a --delete $(DEV_DEPLOY_SRC) $(DEV_DEPLOY_DST) && echo 'done.'
deploy:			; cd $(DEV_APP_DIR) && npm run build && echo 'Deploying $(DEV_DEPLOY_SRC) to $(DEV_DEPLOY_DST)' && sudo rsync -a --delete $(DEV_DEPLOY_SRC) $(DEV_DEPLOY_DST) && echo 'done.'
fetch:		; cd $(DEV_APP_DIR) && npm run fetch 
clean-build: ; cd $(DEV_APP_DIR) && rm -rf node_modules package-lock.json && npm install && npm ci && npm run fetch && npm run build


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
