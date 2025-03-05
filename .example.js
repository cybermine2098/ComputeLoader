module.exports = {
    data:{
        purpose:'A basic test file that contains arguments and is a demonstration',
        name:'Basic test file',
        arguments:[
            {
                name:'argument1',
                type:'string',
                purpose:'A string argument to test passthroughing',
                default:'default value',
                required:true,
            },
            {
                name:'argument2',
                type:'number',
                default:1,
                purpose:'A number argument to test passthroughing, and compute math to make sure it is passed as a number',
                required:false,
            },
            {
                name:'argument3',
                type:'boolean',
                purpose:'A boolean argument to test passthroughing',
                required:true,
                default:true,
            },
            {
                name:'argument4',
                type:'object',
                purpose:'An object argument to test passthroughing. this object should parsed and be passed as an object',
                required:false,
            },
            {
                name:'argument5',
                type:'choice',
                purpose:'A choice argument to test passthroughing. this object should be passed as a string',
                required:true,
                choices:['choice1','choice2','choice3'],
            }
        ],
        configuration:{
            ideal_execution:30000,//in milliseconds
            maximum_execution:60000,//in milliseconds
            external_dependent:false,//if it depends on an API or external service
            external_urls:[],//if it depends on an external service, provide the URLs
        }
    },
    async execute(string,number,boolean,object,choice){
        console.log('Executing basic test file');
        console.log('String:',string);
        console.log('Number plus ten:',number+10);
        console.log('Boolean inverted:',!boolean);
        console.log('Object keys:',Object.keys(object));
        console.log('Choice:',choice);
        return;
    }
}