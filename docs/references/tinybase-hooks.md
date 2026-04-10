# TinyBase React Hooks Reference

TinyBase provides a comprehensive set of React hooks in the `tinybase/ui-react` package. These hooks automatically subscribe to store changes and trigger re-renders. Listeners are registered on mount and cleaned up on unmount -- no manual subscription management is needed.

## Reading Data

These hooks return current values and automatically re-render the component when the underlying data changes.

### Values

- `useValue(valueId)` -- Returns a single value and re-renders on change.
- `useValues()` -- Returns all values as an object.
- `useValueIds()` -- Returns an array of all value IDs.

### Tables and Rows

- `useTable(tableId)` -- Returns the entire table object with all rows.
- `useTables()` -- Returns all tables.
- `useTableIds()` -- Returns an array of table IDs.
- `useRow(tableId, rowId)` -- Returns a single row object (all cells in that row).
- `useRowIds(tableId)` -- Returns an array of row IDs for a table.
- `useSortedRowIds(tableId, cellId, descending, offset, limit)` -- Returns sorted and paginated row IDs. Useful for lists sorted by a cell value such as `createdAt`.

### Cells

- `useCell(tableId, rowId, cellId)` -- Returns a single cell value.
- `useCellIds(tableId, rowId)` -- Returns cell IDs for a specific row.
- `useTableCellIds(tableId)` -- Returns all cell IDs used across the entire table.

## Existence Checks

- `useHasTables()` -- Returns a boolean indicating whether any tables exist.
- `useHasTable(tableId)` -- Returns a boolean indicating whether a specific table exists.
- `useHasRow(tableId, rowId)` -- Returns a boolean indicating whether a specific row exists.
- `useHasCell(tableId, rowId, cellId)` -- Returns a boolean indicating whether a specific cell exists.

## Callback Hooks

These hooks return callback functions that can be wired to UI events for performing mutations.

- `useSetCellCallback(tableId, rowId, cellId, getCell)` -- Returns a callback to update a cell based on event parameters.
- `useAddRowCallback(tableId, getRow)` -- Returns a callback to add a new row.
- `useDelRowCallback(tableId, getRowId)` -- Returns a callback to delete a row.
- `useSetTableCallback(tableId, getTable)` -- Returns a callback to set an entire table.
- `useDelTableCallback(tableId)` -- Returns a callback to delete a table.

## Store Management

- `useCreateStore()` -- Memoizes Store creation to prevent recreation across renders.
- `useStore()` -- Retrieves the Store from the Provider context.
- `useStoreIds()` -- Gets IDs of all named Stores in the Provider.

## Listener Hooks

These hooks register custom side-effect listeners for store changes.

- `useCellListener(tableId, rowId, cellId, listener)` -- Custom listener for cell changes.
- `useRowListener(tableId, rowId, listener)` -- Custom listener for row changes.
- `useTableListener(tableId, listener)` -- Custom listener for table changes.
- `useValuesListener(listener)` -- Custom listener for values changes.

## Best Practices

### Automatic Lifecycle Management

All hooks automatically register listeners on mount and clean them up on unmount. There is no need for manual subscription cleanup.

### Granular Subscriptions

Use the most specific hook for your needs. Prefer `useCell()` over `useRow()` if you only need one cell value. This reduces unnecessary re-renders.

### Computed Data with useMemo

Use `useMemo()` when transforming TinyBase data (filtering, mapping, etc.) to avoid recomputing on every render. Depend on the specific hook results:

```typescript
const messageIds = useRowIds("messages");
const chatMessages = useMemo(
	() =>
		messageIds
			.map((id) => store.getRow("messages", id))
			.filter((msg) => msg?.chatId === currentChatId),
	[messageIds, currentChatId],
);
```

### Mutations via Actions

Direct store mutations should go through action functions in `src/actions/`, not through callback hooks. Callback hooks are useful when you need event parameters to determine mutation values.

### Sorting and Pagination

`useSortedRowIds()` is ideal for displaying lists sorted by a cell value (like `createdAt` for chat history). It returns just IDs; use `useRow()` for each item to render the details.

### Foreign Key Patterns

When querying related data (for example, messages for a specific chat), use `useRowIds()` to get all IDs, then filter using the store directly or in `useMemo()`:

```typescript
const messageIds = useRowIds("messages");
const chatMessages = useMemo(
	() =>
		messageIds
			.map((id) => store.getRow("messages", id))
			.filter((msg) => msg?.chatId === currentChatId),
	[messageIds, currentChatId],
);
```

### Provider Pattern

The app uses `<Provider store={store}>` in `_layout.tsx`. All hooks access this store by default. There is no need to pass the store explicitly unless you are using multiple stores.
