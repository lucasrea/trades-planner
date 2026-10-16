SELECT 'quotes' AS src, count(*) FROM quotes
UNION ALL SELECT 'documents_quotes', count(*) FROM documents WHERE type = 'quote'
UNION ALL SELECT 'invoices', count(*) FROM invoices
UNION ALL SELECT 'documents_invoices', count(*) FROM documents WHERE type = 'invoice';
