# ADAPTERS
This idea comes to solve the dependencies issue, each unit of work can work on any adapters which implement the same interface.


## Input Adapter
it is responsible for generate or send the data to the handlers which is separated by name of channel/event key-value pairs of `string : function(data):Promise`
### Interfaces
Adapter is a class receiving an object with has the channel name as the property name, and function handler is a value

### Example
```
const InputAdapter = require('./campaign_adapters/input_adapters/agenda/agenda-input-adapter')

const handlers = {
    channel1 : async (data) => {},
    channel2 : (data)=>{return new Promise(..)}
}
const input = new InputAdapter(handlers)

await input.setting(..some_custom_setting..) // for any custom setting , can be ignore but should implement this

await input.connect() // start getting data
await input.disconnect() //destroy any connections
```

### Methods

#### connect is start to receive the messages.
```
.connect() : Promise
.setting(object) : Promise
.disconnect() : Promise
```



## Output Adapter
it is a responsible handler for publishing the generated data. publishing to other modules or microservices somehow. 
### Interfaces
Adapter is a class which may needs to be config before publishing the messages.
messages will publish according to channel name
### Example
```
const OutputAdapter = require('./campaign_adapters/output_adapters/mq/rabbitmq-output-adapter')

const output = new OutputAdapter()

await output.setting(..some_custom_setting..) // for any custom setting , can be ignore but should implement this

await input.connect() // connect to any connections
await input.publish({channel = 'facebook', data='hello world'})
await input.disconnect() //destroy any connections
```

### Methods

#### connect is start to receive the messages.
```
.connect() : Promise
.setting(object) : Promise
.disconnect():Promise

```
