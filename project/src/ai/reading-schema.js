export const READING_SCHEMA = {
  type:'object',additionalProperties:false,required:['title','sections'],properties:{
    title:{type:'string',maxLength:200},
    sections:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,required:['title','text','citations'],properties:{
      title:{type:'string',maxLength:200},text:{type:'string',minLength:1,maxLength:6000},citations:{type:'array',minItems:1,maxItems:12,items:{type:'string'}},
    }}},
  },
};
