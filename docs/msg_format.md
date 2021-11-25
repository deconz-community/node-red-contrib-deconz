# Msg Format

On the input and get nodes you can have different payload format for the outputs. There are multiple kinds of settings
for the data format, the type, the device format and the payload format.

## Basic format example

The message will contain multiple properties.

### payload

The payload as selected in the payload setting. It’s could be a simple value or an object with key value.

### topic

The value set inside the node configuration.

### payload_format :new:

Contain what is send inside the payload. Can be ‘__complete__’ if the payload contains all attributes of the device or
one of the keys of the value. Ex : buttonevent

### payload_raw (Only for input node)

Contain the raw data sent by deconz that lead to this msg.

### payload_count (Only for get node with maths format) :new:

Contain the count of devices used to calculate the value for the given attribute.

### meta

All attributes of the device that send data

### meta_changed :new:

Contain an array of all values changed since last time in dot notation. Ex : “state.lastupdated”

## Payload format

The payload format value can be either Complete payload, Each payload or a list of selected value. Be careful, you will
get a message per selected value. If you want to have multiple value inside a message just select Complete payload.

## Device format

The device format set if the data should be sent one message per device, or one message with all device, or apply some
math on the values.

### Single x … y … z

The node will send a message per device that send data.

### Array [x,y,z]

The node will send a message with all payload inside an array. The message will contain a payload that is an array of
single message. Ex msg.payload[0].payload is the payload of the first device. Each element will contain only the
properties payload, meta, meta_changed. The properties topic, payload_format, payload_raw will be on the msg directly.

### Maths formats

Where is specials format that do simple maths on values. The result will be inside the payload with the same structure
as the initial payload. Only numeric values are kept, the values like “1234” are string and not numeric. The meta
property will be always an array with all devices. If some devices don’t have all properties the missing one will be
skipped for devices that don’t have it.

For examples below the data are:

Device x

```json
{
  "lastupdated": "2021-09-06T15:39:13.168",
  "temperature": 2500
}
```

Device y

```json
{
  "lastupdated": "2021-09-06T15:39:13.168",
  "temperature": 3000
}
```

Device z

```json
{
  "lastupdated": "2021-09-06T15:39:13.168",
  " humidity": 5570
}
```

#### Sum (x+y+z)

All properties of the devices will be added individually.

Example results

```json
{
  "temperature": 5500,
  "humidity": 5570
}
```

I know adding temperature don’t make sense but could be useful for power usage.

#### Average (x+y+z)/3

All properties of the devices will be added recursively and then divided by the amount of device that have that
property.

Example results

```json
{
  "temperature": 2750,
  "humidity": 5570
}
```

#### Min X+y+Z = y

The result will be a set of minimal value of each property. Example results

```json
{
  "temperature": 2500,
  "humidity": 5570
}
```

#### Max X + y + z = X

The result will be a set of maximal value of each property. Example results

```json
{
  "temperature": 3000,
  "humidity": 5570
}
```