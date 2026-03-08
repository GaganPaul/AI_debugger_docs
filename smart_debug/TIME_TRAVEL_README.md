# Time-Travel Debugging Navigation

The Smart Debugger includes a powerful time-travel debugging feature that allows you to navigate through execution history and inspect variable states at any point during program execution.

## Overview

Time-travel debugging lets you:

- Step backward and forward through execution history
- Jump to specific lines or steps
- View variable states at any point in time
- Track how variables change throughout execution
- Filter execution by function or variable
- Navigate directly to crash points

## Getting Started

### Basic Usage

After a crash has been recorded, you can navigate through its execution history:

```bash
smart-debug navigate <crash-id>
```

You can find crash IDs using the `history` command:

```bash
smart-debug history
```

### Interactive Navigation

Once in navigation mode, you'll see an execution summary and the current state:

```
=== Execution Summary ===
Total steps: 1247
Total time: 0.523s
Functions: 8
Files: 3

Crash: ValueError at line 42

=== Time-Travel Navigation ===
Step 1247/1247
Location: script.py:42 in process_data()
Time: 0.523s

Changed variables:
  result = None

navigate>
```

## Commands

### Navigation Commands

#### Step Backward: `b [n]`

Move backward through execution history:

```
navigate> b        # Step back 1 step
navigate> b 5      # Step back 5 steps
navigate> b 100    # Step back 100 steps
```

#### Step Forward: `f [n]`

Move forward through execution history:

```
navigate> f        # Step forward 1 step
navigate> f 10     # Step forward 10 steps
```

#### Jump to Line: `j <line>`

Jump to the last occurrence of a specific line number:

```
navigate> j 42     # Jump to line 42
navigate> j 15     # Jump to line 15
```

#### Jump to Step: `s <step>`

Jump to a specific step number:

```
navigate> s 100    # Jump to step 100
navigate> s 1      # Jump to first step
```

#### Jump to Crash: `c`

Jump directly to the crash point:

```
navigate> c        # Jump to where the crash occurred
```

### Variable Inspection

#### Show Variable History: `v [name]`

View how a variable changed throughout execution:

```
navigate> v data
History of 'data':
  Step 10 (line 15, t=0.012s): []
  Step 234 (line 25, t=0.156s): [1, 2, 3]
  Step 1242 (line 38, t=0.518s): [1, 2, 3, 4, 5]
```

Without a variable name, shows all variables at current step:

```
navigate> v
All variables:
  x = 10
  y = 20
  result = None
  data = [1, 2, 3, 4, 5]
```

### Filtering

#### Filter by Function: `fn <name>`

Show all steps where a specific function was executing:

```
navigate> fn process_data
Steps in function 'process_data':
  Step 100: line 35 (t=0.123s)
  Step 101: line 36 (t=0.125s)
  Step 102: line 37 (t=0.127s)
  ...
```

#### Filter by Variable: `var <name>`

Show all steps where a specific variable changed:

```
navigate> var result
Steps where 'result' changed:
  Step 50: line 20 = None (t=0.050s)
  Step 234: line 35 = [1, 2, 3] (t=0.234s)
  Step 1242: line 42 = None (t=0.518s)
```

### Display Options

#### Toggle All Variables: `a`

Switch between showing all variables or only changed variables:

```
navigate> a
Showing all variables

Step 1242/1247
Location: script.py:38 in process_data()
Time: 0.518s

Variables:
  x = 10
  y = 20
  data = [1, 2, 3, 4, 5] *
  result = None
```

Variables marked with `*` have changed since the previous step.

### Help and Exit

#### Show Help: `h`

Display the command reference:

```
navigate> h
```

#### Quit: `q`

Exit navigation mode:

```
navigate> q
Exiting time-travel navigation.
```

## Understanding the Display

### State Information

Each state display shows:

```
Step 1242/1247                              # Current step / total steps
Location: script.py:38 in process_data()    # File, line, and function
Time: 0.518s                                # Elapsed time since start

Changed variables:                          # Variables that changed
  data = [1, 2, 3, 4, 5]                   # Variable name and value
```

### Variable Formatting

Variables are formatted for readability:

- **Strings**: Truncated to 50 characters with `...` if longer
- **Lists/Tuples**: Show length if more than 5 items
- **Dicts**: Show item count if more than 5 items
- **None**: Displayed as `None`
- **Other types**: String representation

## Use Cases

### 1. Understanding Crash Causes

Navigate to the crash point and step backward to see what led to the error:

```bash
navigate> c          # Jump to crash
navigate> b 10       # Go back 10 steps
navigate> v result   # Check variable history
```

### 2. Tracking Variable Changes

Find when a variable got an unexpected value:

```bash
navigate> var user_data    # See all changes to user_data
navigate> s 234            # Jump to step where it changed
navigate> b 1              # See the step before
```

### 3. Understanding Function Behavior

See all steps within a specific function:

```bash
navigate> fn calculate_total    # Filter by function
navigate> s 100                 # Jump to first occurrence
navigate> f 1                   # Step through function
```

### 4. Debugging Logic Errors

Step through execution to understand program flow:

```bash
navigate> j 42       # Jump to suspicious line
navigate> b 5        # Go back a few steps
navigate> a          # Show all variables
navigate> f 1        # Step forward one at a time
```

## Tips and Best Practices

1. **Start at the crash**: Use `c` to jump to the crash point first
2. **Use filtering**: Filter by function or variable to focus on relevant code
3. **Check variable history**: Use `v <name>` to see how values evolved
4. **Step backward from errors**: Go back from the crash to find the root cause
5. **Toggle display modes**: Use `a` to switch between changed and all variables

## Limitations

- Maximum trace size: 100MB or 10,000 steps (automatically truncated)
- Variable values are serialized representations (not live objects)
- Very large collections are truncated for display
- Execution overhead: ~20% slower when tracing is enabled

## Programmatic Usage

You can also use the TimeTravel class programmatically:

```python
from smart_debug.storage import LocalStorage
from smart_debug.time_travel import TimeTravel

# Load trace data
storage = LocalStorage()
trace_data = storage.get_trace(trace_id)

# Create navigator
navigator = TimeTravel(trace_data['trace_data'])

# Navigate programmatically
state = navigator.jump_to_crash()
print(navigator.format_state(state))

# Get variable history
history = navigator.get_variable_history('x')
for entry in history:
    print(f"Step {entry['step_index']}: {entry['value']}")
```

## See Also

- [Main README](../README.md) - General Smart Debugger documentation
- [Examples](../examples/time_travel_example.py) - Time-travel usage examples
- [Tests](../tests/test_time_travel.py) - Test cases showing functionality
