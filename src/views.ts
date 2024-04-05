import { View } from '@slack/types';

export const Views = {
  HACK_HOUR: 'hackhourView'
}

export const HackHourView: View = {
  type: 'modal',
  // View identifier
  callback_id: Views.HACK_HOUR,
  title: {
    type: 'plain_text',
    text: 'Start your Hack Hour'
  },
  blocks: [
    {
      type: 'input',
      label: {
        type: 'plain_text',
        text: 'What are you planning to do for your hack hour?'
      },
      element: {
        type: 'plain_text_input',
        multiline: true,
        action_id: 'workInput'
      },
      block_id: 'desc'
    }    
  ],
  submit: {
    type: 'plain_text',
    text: 'Submit'
  }
}