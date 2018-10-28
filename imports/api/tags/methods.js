import { Meteor } from 'meteor/meteor'
import SimpleSchema from 'simpl-schema'
import { ValidatedMethod } from 'meteor/mdg:validated-method'

import { Tags } from './tags'

export const addTag = (name) => {
    return Tags.insert({
        name: name,
        mentions: 1,
        createdAt: new Date().getTime()
    })
}

export const getTag = (name) => {
    return Tags.findOne({
        name: new RegExp(name, 'i')
    })
}

// gets add tag with same name 
export const getTags = (name) => {
    return Tags.find({
        name: new RegExp(name, 'i')
    }, {
        sort: {
            mentions: -1
        }
    })
}

// delete a tag. Remove duplicates
export const deleteTag = (id) => {
    return Tags.remove({ _id: id })
} 

export const mentionTag = (tagId) => {
    let tag = Tags.findOne({ _id : tagId });
    tag.mentions = parseInt(tag.mentions) + 1

    return Tags.update({
        _id : tagId
    }, 
    { 
        $set: { 
            mentions : tag.mentions
        } 
    })
}