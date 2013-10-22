slideshow_jquery_image_gallery_backend_script.mediaFrame = function()
{
	var $    = jQuery,
		self = { };

	/**
	 *
	 */
	self.registerMediaFrames = function()
	{
		self.SlideManager  = self.SlideManager();
		self.SlideManager2 = self.SlideManager2();
	};

	/**
	 * Creates the customized extension of the media frame.
	 */
	self.SlideManager2 = function()
	{
		return wp.media.view.MediaFrame.Select.extend({
			initialize: function() {
				_.defaults( this.options, {
					multiple:  true,
					editing:   false,
					state:    'insert'
				});

				wp.media.view.MediaFrame.Select.prototype.initialize.apply( this, arguments );
				this.createIframeStates();
			},

			createStates: function() {
				var options = this.options;

				// Add the default states.
				this.states.add([
					// Main states.
					new wp.media.controller.Library({
						id:         'insert',
						title:      wp.media.view.l10n.insertMediaTitle,
						priority:   20,
						toolbar:    'main-insert',
						filterable: 'all',
						library:    wp.media.query( options.library ),
						multiple:   options.multiple ? 'reset' : false,
						editable:   true,

						// If the user isn't allowed to edit fields,
						// can they still edit it locally?
						allowLocalEdits: true,

						// Show the attachment display settings.
						displaySettings: true,
						// Update user settings when users adjust the
						// attachment display settings.
						displayUserSettings: true
					}),

					new wp.media.controller.Library({
						id:         'gallery',
						title:      wp.media.view.l10n.createGalleryTitle,
						priority:   40,
						toolbar:    'main-gallery',
						filterable: 'uploaded',
						multiple:   'add',
						editable:   false,

						library:  wp.media.query( _.defaults({
							type: 'image'
						}, options.library ) )
					}),

					// Embed states.
					new wp.media.controller.Embed(),

					// Gallery states.
					new wp.media.controller.GalleryEdit({
						library: options.selection,
						editing: options.editing,
						menu:    'gallery'
					}),

					new wp.media.controller.GalleryAdd()
				]);


				if ( wp.media.view.settings.post.featuredImageId ) {
					this.states.add( new wp.media.controller.FeaturedImage() );
				}
			},

			bindHandlers: function() {
				wp.media.view.MediaFrame.Select.prototype.bindHandlers.apply( this, arguments );
				this.on( 'menu:create:gallery', this.createMenu, this );
				this.on( 'toolbar:create:main-insert', this.createToolbar, this );
				this.on( 'toolbar:create:main-gallery', this.createToolbar, this );
				this.on( 'toolbar:create:featured-image', this.featuredImageToolbar, this );
				this.on( 'toolbar:create:main-embed', this.mainEmbedToolbar, this );

				var handlers = {
					menu: {
						'default': 'mainMenu',
						'gallery': 'galleryMenu'
					},

					content: {
						'embed':          'embedContent',
						'edit-selection': 'editSelectionContent'
					},

					toolbar: {
						'main-insert':      'mainInsertToolbar',
						'main-gallery':     'mainGalleryToolbar',
						'gallery-edit':     'galleryEditToolbar',
						'gallery-add':      'galleryAddToolbar'
					}
				};

				_.each( handlers, function( regionHandlers, region ) {
					_.each( regionHandlers, function( callback, handler ) {
						this.on( region + ':render:' + handler, this[ callback ], this );
					}, this );
				}, this );
			},

			// Menus
			mainMenu: function( view ) {
				view.set({
					'library-separator': new wp.media.View({
						className: 'separator',
						priority: 100
					})
				});
			},

			galleryMenu: function( view ) {
				var lastState = this.lastState(),
					previous = lastState && lastState.id,
					frame = this;

				view.set({
					cancel: {
						text:     wp.media.view.l10n.cancelGalleryTitle,
						priority: 20,
						click:    function() {
							if ( previous )
								frame.setState( previous );
							else
								frame.close();
						}
					},
					separateCancel: new wp.media.View({
						className: 'separator',
						priority: 40
					})
				});
			},

			// Content
			embedContent: function() {
				var view = new wp.media.view.Embed({
					controller: this,
					model:      this.state()
				}).render();

				this.content.set( view );
				view.url.focus();
			},

			editSelectionContent: function() {
				var state = this.state(),
					selection = state.get('selection'),
					view;

				view = new wp.media.view.AttachmentsBrowser({
					controller: this,
					collection: selection,
					selection:  selection,
					model:      state,
					sortable:   true,
					search:     false,
					dragInfo:   true,

					AttachmentView: wp.media.view.Attachment.EditSelection
				}).render();

				view.toolbar.set( 'backToLibrary', {
					text:     wp.media.view.l10n.returnToLibrary,
					priority: -100,

					click: function() {
						this.controller.content.mode('browse');
					}
				});

				// Browse our library of attachments.
				this.content.set( view );
			},

			// Toolbars
			selectionStatusToolbar: function( view ) {
				var editable = this.state().get('editable');

				view.set( 'selection', new wp.media.view.Selection({
					controller: this,
					collection: this.state().get('selection'),
					priority:   -40,

					// If the selection is editable, pass the callback to
					// switch the content mode.
					editable: editable && function() {
						this.controller.content.mode('edit-selection');
					}
				}).render() );
			},

			mainInsertToolbar: function( view ) {
				var controller = this;

				this.selectionStatusToolbar( view );

				view.set( 'insert', {
					style:    'primary',
					priority: 80,
					text:     wp.media.view.l10n.insertIntoPost,
					requires: { selection: true },

					click: function() {
						var state = controller.state(),
							selection = state.get('selection');

						controller.close();
						state.trigger( 'insert', selection ).reset();
					}
				});
			},

			mainGalleryToolbar: function( view ) {
				var controller = this;

				this.selectionStatusToolbar( view );

				view.set( 'gallery', {
					style:    'primary',
					text:     wp.media.view.l10n.createNewGallery,
					priority: 60,
					requires: { selection: true },

					click: function() {
						var selection = controller.state().get('selection'),
							edit = controller.state('gallery-edit'),
							models = selection.where({ type: 'image' });

						edit.set( 'library', new wp.media.model.Selection( models, {
							props:    selection.props.toJSON(),
							multiple: true
						}) );

						this.controller.setState('gallery-edit');
					}
				});
			},

			featuredImageToolbar: function( toolbar ) {
				this.createSelectToolbar( toolbar, {
					text:  wp.media.view.l10n.setFeaturedImage,
					state: this.options.state
				});
			},

			mainEmbedToolbar: function( toolbar ) {
				toolbar.view = new wp.media.view.Toolbar.Embed({
					controller: this
				});
			},

			galleryEditToolbar: function() {
				var editing = this.state().get('editing');
				this.toolbar.set( new wp.media.view.Toolbar({
					controller: this,
					items: {
						insert: {
							style:    'primary',
							text:     editing ? wp.media.view.l10n.updateGallery : wp.media.view.l10n.insertGallery,
							priority: 80,
							requires: { library: true },

							click: function() {
								var controller = this.controller,
									state = controller.state();

								controller.close();
								state.trigger( 'update', state.get('library') );

								// Restore and reset the default state.
								controller.setState( controller.options.state );
								controller.reset();
							}
						}
					}
				}) );
			},

			galleryAddToolbar: function() {
				this.toolbar.set( new wp.media.view.Toolbar({
					controller: this,
					items: {
						insert: {
							style:    'primary',
							text:     wp.media.view.l10n.addToGallery,
							priority: 80,
							requires: { selection: true },

							click: function() {
								var controller = this.controller,
									state = controller.state(),
									edit = controller.state('gallery-edit');

								edit.get('library').add( state.get('selection').models );
								state.trigger('reset');
								controller.setState('gallery-edit');
							}
						}
					}
				}) );
			}
		});
	};

	/**
	 * Creates the customized extension of the media frame.
	 */
	self.SlideManager = function()
	{
		return wp.media.view.MediaFrame.Select.extend({
			initialize: function() {
				_.defaults( this.options, {
					multiple:  true,
					editing:   false,
					state:    'insert'
				});

				wp.media.view.MediaFrame.Select.prototype.initialize.apply( this, arguments );
				this.createIframeStates();
			},

			createStates: function() {
				var options = this.options;

				// Add the default states.
				this.states.add([
					// Main states.
					new wp.media.controller.Library({
						id:         'insert',
						title:      wp.media.view.l10n.insertMediaTitle,
						priority:   20,
						toolbar:    'main-insert',
						filterable: 'all',
						library:    wp.media.query( options.library ),
						multiple:   options.multiple ? 'reset' : false,
						editable:   true,

						// If the user isn't allowed to edit fields,
						// can they still edit it locally?
						allowLocalEdits: true,

						// Show the attachment display settings.
						displaySettings: true,
						// Update user settings when users adjust the
						// attachment display settings.
						displayUserSettings: true
					}),

//					new wp.media.controller.Library({
//						id:         'gallery',
//						title:      wp.media.view.l10n.createGalleryTitle,
//						priority:   40,
//						toolbar:    'main-gallery',
//						filterable: 'uploaded',
//						multiple:   'add',
//						editable:   false,
//
//						library:  wp.media.query( _.defaults({
//							type: 'image'
//						}, options.library ) )
//					}),

					// Embed states.
					new wp.media.controller.Embed()

//					// Gallery states.
//					new wp.media.controller.GalleryEdit({
//						library: options.selection,
//						editing: options.editing,
//						menu:    'gallery'
//					}),
//
//					new wp.media.controller.GalleryAdd()
				]);


				if ( wp.media.view.settings.post.featuredImageId ) {
					this.states.add( new wp.media.controller.FeaturedImage() );
				}
			},

			bindHandlers: function() {
				wp.media.view.MediaFrame.Select.prototype.bindHandlers.apply( this, arguments );
//				this.on( 'menu:create:gallery', this.createMenu, this );
				this.on( 'toolbar:create:main-insert', this.createToolbar, this );
//				this.on( 'toolbar:create:main-gallery', this.createToolbar, this );
				this.on( 'toolbar:create:featured-image', this.featuredImageToolbar, this );
				this.on( 'toolbar:create:main-embed', this.mainEmbedToolbar, this );

				var handlers = {
					menu: {
						'default': 'mainMenu'
//						'gallery': 'galleryMenu'
					},

					content: {
						'embed':          'embedContent',
						'edit-selection': 'editSelectionContent'
					},

					toolbar: {
						'main-insert':      'mainInsertToolbar'
//						'main-gallery':     'mainGalleryToolbar',
//						'gallery-edit':     'galleryEditToolbar',
//						'gallery-add':      'galleryAddToolbar'
					}
				};

				_.each( handlers, function( regionHandlers, region ) {
					_.each( regionHandlers, function( callback, handler ) {
						this.on( region + ':render:' + handler, this[ callback ], this );
					}, this );
				}, this );
			},

//			// Menus
//			mainMenu: function( view ) {
//				view.set({
//					'library-separator': new wp.media.View({
//						className: 'separator',
//						priority: 100
//					})
//				});
//			},

//			galleryMenu: function( view ) {
//				var lastState = this.lastState(),
//					previous = lastState && lastState.id,
//					frame = this;
//
//				view.set({
//					cancel: {
//						text:     wp.media.view.l10n.cancelGalleryTitle,
//						priority: 20,
//						click:    function() {
//							if ( previous )
//								frame.setState( previous );
//							else
//								frame.close();
//						}
//					},
//					separateCancel: new wp.media.View({
//						className: 'separator',
//						priority: 40
//					})
//				});
//			},

			// Content
			embedContent: function() {
				var view = new wp.media.view.Embed({
					controller: this,
					model:      this.state()
				}).render();

				this.content.set( view );
				view.url.focus();
			},

			editSelectionContent: function() {
				var state = this.state(),
					selection = state.get('selection'),
					view;

				view = new wp.media.view.AttachmentsBrowser({
					controller: this,
					collection: selection,
					selection:  selection,
					model:      state,
					sortable:   true,
					search:     false,
					dragInfo:   true,

					AttachmentView: wp.media.view.Attachment.EditSelection
				}).render();

				view.toolbar.set( 'backToLibrary', {
					text:     wp.media.view.l10n.returnToLibrary,
					priority: -100,

					click: function() {
						this.controller.content.mode('browse');
					}
				});

				// Browse our library of attachments.
				this.content.set( view );
			},

			// Toolbars
			selectionStatusToolbar: function( view ) {
				var editable = this.state().get('editable');

				view.set( 'selection', new wp.media.view.Selection({
					controller: this,
					collection: this.state().get('selection'),
					priority:   -40,

					// If the selection is editable, pass the callback to
					// switch the content mode.
					editable: editable && function() {
						this.controller.content.mode('edit-selection');
					}
				}).render() );
			},

			mainInsertToolbar: function( view ) {
				var controller = this;

				this.selectionStatusToolbar( view );

				view.set( 'insert', {
					style:    'primary',
					priority: 80,
					text:     wp.media.view.l10n.insertIntoPost,
					requires: { selection: true },

					click: function() {
						var state = controller.state(),
							selection = state.get('selection');

						controller.close();
						state.trigger( 'insert', selection ).reset();
					}
				});
			},

//			mainGalleryToolbar: function( view ) {
//				var controller = this;
//
//				this.selectionStatusToolbar( view );
//
//				view.set( 'gallery', {
//					style:    'primary',
//					text:     wp.media.view.l10n.createNewGallery,
//					priority: 60,
//					requires: { selection: true },
//
//					click: function() {
//						var selection = controller.state().get('selection'),
//							edit = controller.state('gallery-edit'),
//							models = selection.where({ type: 'image' });
//
//						edit.set( 'library', new wp.media.model.Selection( models, {
//							props:    selection.props.toJSON(),
//							multiple: true
//						}) );
//
//						this.controller.setState('gallery-edit');
//					}
//				});
//			},

			featuredImageToolbar: function( toolbar ) {
				this.createSelectToolbar( toolbar, {
					text:  wp.media.view.l10n.setFeaturedImage,
					state: this.options.state
				});
			},

			mainEmbedToolbar: function( toolbar ) {
				toolbar.view = new wp.media.view.Toolbar.Embed({
					controller: this
				});
			}

//			galleryEditToolbar: function() {
//				var editing = this.state().get('editing');
//				this.toolbar.set( new wp.media.view.Toolbar({
//					controller: this,
//					items: {
//						insert: {
//							style:    'primary',
//							text:     editing ? wp.media.view.l10n.updateGallery : wp.media.view.l10n.insertGallery,
//							priority: 80,
//							requires: { library: true },
//
//							click: function() {
//								var controller = this.controller,
//									state = controller.state();
//
//								controller.close();
//								state.trigger( 'update', state.get('library') );
//
//								// Restore and reset the default state.
//								controller.setState( controller.options.state );
//								controller.reset();
//							}
//						}
//					}
//				}) );
//			},

//			galleryAddToolbar: function() {
//				this.toolbar.set( new wp.media.view.Toolbar({
//					controller: this,
//					items: {
//						insert: {
//							style:    'primary',
//							text:     wp.media.view.l10n.addToGallery,
//							priority: 80,
//							requires: { selection: true },
//
//							click: function() {
//								var controller = this.controller,
//									state = controller.state(),
//									edit = controller.state('gallery-edit');
//
//								edit.get('library').add( state.get('selection').models );
//								state.trigger('reset');
//								controller.setState('gallery-edit');
//							}
//						}
//					}
//				}) );
//			}
		});
	};

	$(document).bind('slideshowBackendReady', self.registerMediaFrames);

	return self;
}();