import './learnForm.html'

import { Template } from 'meteor/templating'
import { FlowRouter } from 'meteor/kadira:flow-router'

import { Learn } from '/imports/api/learn/learn'
import { Tags } from '/imports/api/tags/tags'
import { TranslationGroups } from '../../../api/translationGroups/translationGroups';
import { notify } from '/imports/modules/notifier'

import { newLearningItem, editLearningItem } from '/imports/api/learn/methods'

import SimpleMDE from 'simplemde'
import swal from 'sweetalert2'

import _ from 'lodash'

import { insertImage, replaceSelection } from '/imports/ui/shared/uploader/uploader'

export const insertVideo = editor => {
    const cm = editor.codemirror

    const state = SimpleMDE.prototype.getState.call(editor)
    const options = editor.options

    swal({
		title: TAPi18n.__('learn.form.youtube'),
		input: 'text',
		showCancelButton: true,
		inputValidator: (value) => {
		  	return !/youtu(\.|)be/.test(value) && TAPi18n.__('learn.form.invalid_yt')
		}
	}).then(data => {
		if (data.value) {
			let videoId = data.value.match(/(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v)\/))([^\?&"'>]+)/)[5] // fairly complex regex that extracts video id from the youtube link

			if (videoId && /[0-9A-Za-z_-]{10}[048AEIMQUYcgkosw]/.test(videoId)) { // videoId has certain constrains so we can check if it's valid
				replaceSelection(cm, state.video, ['<iframe width="560" height="315" ', 'src="#url#" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>'], `https://www.youtube.com/embed/${videoId}`)
			} else {
				notify(TAPi18n.__('learn.form.invalid_yt'), 'error')
			}
		}
	})
}

const maxCharValue = (inputId) => {
  if (inputId === 'title') {
    return 90
  } else if (inputId === 'summary') {
    return 260
  } else {
    return 5000
  }
}

Template.learnForm.onCreated(function() {
	if (FlowRouter.current().route.name.startsWith('edit') || FlowRouter.current().route.name.startsWith('translate')) {
		this.autorun(() => {
			this.subscribe('learn.item', FlowRouter.getParam('slug'))
				
			this.subscribe('translationGroups.itemSlug', {slug: FlowRouter.getParam('slug'), contentType: 'learn'});
		})
	}

	this.autorun(() => {
		this.subscribe('tags')
	})
})

Template.learnForm.onRendered(function() {
    this.autorun(() => {
        let learn = Learn.findOne({
            slug: FlowRouter.getParam('slug')
        })

        // preselect the correct type if it's on the project edit page
        if (learn) {
            $('[name=difficultyLevel]').val([learn.difficultyLevel])
        }
    })
})

Template.learnForm.onRendered(function() {
  	this.mde = new SimpleMDE({
    	element: $("#content")[0],
    	toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'clean-block', 'link', {
      		name: 'insertImage',
      		action: insertImage,
      		className: 'fa fa-picture-o',
      		title: 'Insert image'
    	}, {
    		name: 'insertVideo',
    		action: insertVideo,
    		className: 'fa fa-file-video-o',
    		title: 'Insert YouTube video'
    	}, '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'],
			previewRender: (content) => marked(content, {sanitize: true}),
  	})

  	window.mde = this.mde

	this.autorun(() => {
		let learn = Learn.findOne({
			slug: FlowRouter.getParam('slug')
		});
		if (learn) {
			this.mde.value(learn.content);

			// If dificulty level exist on editing
			if (learn.difficultyLevel) {
				this.$('input[name="difficultyLevel"]').val(learn.difficultyLevel)
			}
		}
	})
})

Template.learnForm.helpers({
	isNew: () => (FlowRouter.current().route.name.startsWith('new')),
	isEdit: () => (FlowRouter.current().route.name.startsWith('edit')),
	isTranslate: () => FlowRouter.current().route.name.startsWith('translate'),

	learn: () => Learn.findOne({
		slug: FlowRouter.getParam('slug')
  	}),
	learnTags: () => (Learn.findOne({ slug: FlowRouter.getParam('slug') }) || {}).tags || [],
	
	languages: () => {
		const group = TranslationGroups.findOne({});
		const isTranslate = FlowRouter.current().route.name.startsWith('translate');
		return Object.keys(TAPi18n.languages_names).map(key => {
			const hasTranslation = group ? group.translations.some(t => t.language === key) : key === 'en';
			return {
				code: key,
				name: TAPi18n.languages_names[key][1],
				selected: !hasTranslation && key === TAPi18n.getLanguage(),
				disabled: isTranslate && hasTranslation,
			};
		});
	},
})

Template.learnForm.events({
	'keyup .form-control': (event, templateInstance) => {
        event.preventDefault()

        let inputId = event.target.id
        let inputValue = event.target.value
        let inputMaxChars = maxCharValue(inputId) - parseInt(inputValue.length)
        let charsLeftText = `${inputMaxChars} ${TAPi18n.__('learn.form.chars_left')}`
        $(`#${inputId}-chars`).text(charsLeftText)

        let specialCodes = [8, 46, 37, 39] // backspace, delete, left, right

        if (inputMaxChars <= 0) {
          	$(`#${inputId}`).keypress((e) => { return !!~specialCodes.indexOf(e.keyCode) })
          	return true
        }
        // Remove validation error, if exists
        $(`#${inputId}`).removeClass('is-invalid')
        $(`#${inputId}`).unbind('keypress')
    },
    'click .new-learn': function(event, templateInstance) {
		event.preventDefault()

        var captchaData = grecaptcha.getResponse();

		let tags = $('#tags').val()

		// convert all tags to array of objects
		tags = tags.map(t => {
			let element = Tags.findOne({
                name: t.trim().toUpperCase()
            })

 			// add the element to the array if it not present
			if (!element) {
				return {
                    id: '',
                    name: t.trim().toUpperCase()
                }
			}

			return {
                id: element._id,
                name: element.name
            }
        })

		// Deduplicating tags by name
		const tagsToSave = [];
		const addedTagNames = new Set();
		for (const tag of tags) {
			if (!addedTagNames.has(tag.name)) {
				addedTagNames.add(tag.name);
				tagsToSave.push(tag);
			}
		}
		const isTranslate = FlowRouter.current().route.name.startsWith('translate');
			if (FlowRouter.current().route.name === 'newLearn' || isTranslate) {
				const original = isTranslate ? FlowRouter.getParam('slug') : undefined;
				newLearningItem.call({
					title: $('#title').val(),
					summary: $('#summary').val(),
					content: templateInstance.mde.value(),
					captcha: captchaData,
					tags: tagsToSave,
					difficultyLevel: $('input[name="difficultyLevel"]:checked').val(),
					language: $("#language").val(),
					original,
				}, (err, data) => {
					if (!err) {
						notify(TAPi18n.__('learn.form.success_add'), 'success')

						FlowRouter.go('/learn')

						return
					}

					if (err.details && err.details.length >= 1) {
						err.details.forEach(e => {
							$(`#${e.name}`).addClass('is-invalid')
							$(`#${e.name}Error`).show()
							$(`#${e.name}Error`).text(TAPi18n.__(e.message))
						})
					}
				})
		} else {
			let learn = Learn.findOne({
				slug: FlowRouter.getParam('slug')
			})

			editLearningItem.call({
				learnId: learn._id,
				title: $('#title').val(),
				summary : $('#summary').val(),
				content: templateInstance.mde.value(),
				captcha: captchaData,
				tags: tagsToSave,
				difficultyLevel : $('input[name="difficultyLevel"]:checked').val()
			}, (err, data) => {
				if (!err) {
					notify(TAPi18n.__('learn.form.success_edit'), 'success')

						FlowRouter.go('/learn')

						return
					}

					if (err.details && err.details.length >= 1) {
						err.details.forEach(e => {
								$(`#${e.name}`).addClass('is-invalid')
								$(`#${e.name}Error`).show()
								$(`#${e.name}Error`).text(TAPi18n.__(e.message))
						})
					}
			})
		}
	}
})
