import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Search,
  Image as ImageIcon,
  X,
  Tag,
  Calendar,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  MessageSquare,
  Filter,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';

import { JournalEntry } from '@/types/trading';

const PREDEFINED_TAGS = [
  'Trend Following',
  'Breakout',
  'Reversal',
  'Scalp',
  'Swing',
  'News Trade',
  'FOMO',
  'Revenge Trade',
  'Perfect Setup',
  'Early Exit',
  'Late Entry',
  'Overtraded'
];

const EMOTION_OPTIONS = [
  'Confident',
  'Nervous',
  'Greedy',
  'Fearful',
  'Calm',
  'Frustrated',
  'Excited',
  'Impatient'
];



export const TradeJournal = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  // Fetch Entries
  useEffect(() => {
    fetch('http://localhost:8000/journal/')
      .then(res => res.json())
      .then(data => {
        // Ensure dates are parsed
        const parsed = data.map((e: any) => ({
          ...e,
          date: new Date(e.date)
        }));
        // Sort descending
        parsed.sort((a: JournalEntry, b: JournalEntry) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEntries(parsed);
      })
      .catch(err => console.error("Failed to load journal", err));
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    symbol: '',
    side: 'buy' as 'buy' | 'sell',
    entryPrice: '',
    exitPrice: '',
    notes: '',
    tags: [] as string[],
    screenshots: [] as string[],
    lessons: '',
    emotions: '',
    strategy: ''
  });

  const resetForm = () => {
    setFormData({
      symbol: '',
      side: 'buy',
      entryPrice: '',
      exitPrice: '',
      notes: '',
      tags: [],
      screenshots: [],
      lessons: '',
      emotions: '',
      strategy: ''
    });
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData(prev => ({
            ...prev,
            screenshots: [...prev.screenshots, event.target!.result as string]
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeScreenshot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      screenshots: prev.screenshots.filter((_, i) => i !== index)
    }));
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handleSubmit = async () => {
    const entryPrice = parseFloat(formData.entryPrice);
    const exitPrice = parseFloat(formData.exitPrice);
    const pnl = formData.side === 'buy'
      ? (exitPrice - entryPrice) * 10
      : (entryPrice - exitPrice) * 10;

    const baseEntry = {
      tradeId: editingEntry?.tradeId || ('TRD - ' + Date.now()),
      symbol: formData.symbol,
      side: formData.side,
      entryPrice,
      exitPrice,
      pnl,
      date: editingEntry?.date || new Date().toISOString(),
      notes: formData.notes,
      tags: formData.tags,
      screenshots: formData.screenshots,
      lessons: formData.lessons,
      emotions: formData.emotions,
      strategy: formData.strategy
    };

    try {
      if (editingEntry) {
        const res = await fetch(`http://localhost:8000/journal/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(baseEntry)
        });
        const updated = await res.json();
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...updated, date: new Date(updated.date) } : e));
      } else {
        const res = await fetch('http://localhost:8000/journal/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(baseEntry)
        });
        const created = await res.json();
        setEntries(prev => [{ ...created, date: new Date(created.date) }, ...prev]);
      }

      setIsAddDialogOpen(false);
      setEditingEntry(null);
      resetForm();
    } catch (err) {
      console.error("Failed to save entry", err);
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setFormData({
      symbol: entry.symbol,
      side: entry.side,
      entryPrice: entry.entryPrice.toString(),
      exitPrice: entry.exitPrice.toString(),
      notes: entry.notes,
      tags: entry.tags,
      screenshots: entry.screenshots,
      lessons: entry.lessons,
      emotions: entry.emotions,
      strategy: entry.strategy
    });
    setEditingEntry(entry);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/journal/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error("Failed to delete entry", err);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = entry.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.tradeId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === 'all' || entry.tags.includes(selectedTag);
      const matchesEmotion = selectedEmotion === 'all' || entry.emotions === selectedEmotion;
      return matchesSearch && matchesTag && matchesEmotion;
    });
  }, [entries, searchQuery, selectedTag, selectedEmotion]);

  const stats = useMemo(() => {
    const totalPnL = entries.reduce((sum, e) => sum + e.pnl, 0);
    const winningTrades = entries.filter(e => e.pnl > 0).length;
    const avgPnL = entries.length > 0 ? totalPnL / entries.length : 0;
    const documentedTrades = entries.filter(e => e.notes.length > 0).length;
    return { totalPnL, winningTrades, avgPnL, documentedTrades, totalTrades: entries.length };
  }, [entries]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(e => e.tags.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Trade Journal
          </h2>
          <p className="text-muted-foreground">Document and review your trades</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingEntry(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Trade Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Symbol</label>
                  <Input
                    placeholder="e.g., Volatility 75 Index"
                    value={formData.symbol}
                    onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Side</label>
                  <Select value={formData.side} onValueChange={(v: 'buy' | 'sell') => setFormData(prev => ({ ...prev, side: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Entry Price</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={formData.entryPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, entryPrice: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Exit Price</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={formData.exitPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, exitPrice: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Strategy</label>
                  <Input
                    placeholder="e.g., Breakout"
                    value={formData.strategy}
                    onChange={(e) => setFormData(prev => ({ ...prev, strategy: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Emotions</label>
                  <Select value={formData.emotions} onValueChange={(v) => setFormData(prev => ({ ...prev, emotions: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="How did you feel?" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMOTION_OPTIONS.map(emotion => (
                        <SelectItem key={emotion} value={emotion}>{emotion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-foreground">Trade Notes</label>
                <Textarea
                  placeholder="Describe your trade setup, entry/exit reasoning..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Lessons Learned */}
              <div>
                <label className="text-sm font-medium text-foreground">Lessons Learned</label>
                <Textarea
                  placeholder="What did you learn from this trade?"
                  value={formData.lessons}
                  onChange={(e) => setFormData(prev => ({ ...prev, lessons: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TAGS.map(tag => (
                    <Badge
                      key={tag}
                      variant={formData.tags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Screenshots */}
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <ImageIcon className="w-4 h-4" />
                  Screenshots
                </label>
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleScreenshotUpload}
                    className="cursor-pointer"
                  />
                  {formData.screenshots.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {formData.screenshots.map((src, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={src}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-border"
                          />
                          <button
                            onClick={() => removeScreenshot(index)}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleSubmit} className="w-full">
                {editingEntry ? 'Update Entry' : 'Save Entry'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-xl font-bold text-foreground">{stats.totalTrades}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.totalPnL >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                {stats.totalPnL >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-destructive" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total P&L</p>
                <p className={`text-xl font-bold ${stats.totalPnL >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  ${stats.totalPnL.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-xl font-bold text-foreground">
                  {stats.totalTrades > 0 ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documented</p>
                <p className="text-xl font-bold text-foreground">
                  {stats.documentedTrades}/{stats.totalTrades}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by symbol, notes, or trade ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-[180px]">
                <Tag className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedEmotion} onValueChange={setSelectedEmotion}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by emotion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Emotions</SelectItem>
                {EMOTION_OPTIONS.map(emotion => (
                  <SelectItem key={emotion} value={emotion}>{emotion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No journal entries found</h3>
              <p className="text-muted-foreground mb-4">Start documenting your trades to improve your performance</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add First Entry
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredEntries.map(entry => (
            <Card key={entry.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-foreground">{entry.symbol}</span>
                      <Badge variant={entry.side === 'buy' ? 'default' : 'destructive'}>
                        {entry.side.toUpperCase()}
                      </Badge>
                      <span className={`font-medium ${entry.pnl >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(entry.date), 'MMM d, yyyy')}
                      </span>
                      {entry.strategy && (
                        <Badge variant="outline">{entry.strategy}</Badge>
                      )}
                      {entry.emotions && (
                        <Badge variant="secondary">{entry.emotions}</Badge>
                      )}
                    </div>

                    {/* Price Info */}
                    <div className="text-sm text-muted-foreground">
                      Entry: ${entry.entryPrice.toFixed(2)} → Exit: ${entry.exitPrice.toFixed(2)}
                    </div>

                    {/* Tags */}
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Notes Preview */}
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{entry.notes}</p>
                    )}

                    {/* Screenshots Preview */}
                    {entry.screenshots.length > 0 && (
                      <div className="flex gap-2">
                        {entry.screenshots.slice(0, 3).map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt={`Screenshot ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                            onClick={() => setViewingEntry(entry)}
                          />
                        ))}
                        {entry.screenshots.length > 3 && (
                          <div
                            className="w-16 h-16 rounded border border-border bg-muted flex items-center justify-center cursor-pointer hover:bg-accent"
                            onClick={() => setViewingEntry(entry)}
                          >
                            <span className="text-sm text-muted-foreground">+{entry.screenshots.length - 3}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setViewingEntry(entry)}>
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* View Entry Dialog */}
      <Dialog open={!!viewingEntry} onOpenChange={(open) => !open && setViewingEntry(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>{viewingEntry.symbol}</span>
                  <Badge variant={viewingEntry.side === 'buy' ? 'default' : 'destructive'}>
                    {viewingEntry.side.toUpperCase()}
                  </Badge>
                  <span className={viewingEntry.pnl >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                    {viewingEntry.pnl >= 0 ? '+' : ''}${viewingEntry.pnl.toFixed(2)}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Entry Price:</span>
                    <span className="ml-2 font-medium">${viewingEntry.entryPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exit Price:</span>
                    <span className="ml-2 font-medium">${viewingEntry.exitPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Strategy:</span>
                    <span className="ml-2 font-medium">{viewingEntry.strategy || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Emotions:</span>
                    <span className="ml-2 font-medium">{viewingEntry.emotions || 'N/A'}</span>
                  </div>
                </div>

                {viewingEntry.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingEntry.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {viewingEntry.notes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Trade Notes</h4>
                    <p className="text-muted-foreground bg-muted p-3 rounded-lg">{viewingEntry.notes}</p>
                  </div>
                )}

                {viewingEntry.lessons && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Lessons Learned</h4>
                    <p className="text-muted-foreground bg-muted p-3 rounded-lg">{viewingEntry.lessons}</p>
                  </div>
                )}

                {viewingEntry.screenshots.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Screenshots</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {viewingEntry.screenshots.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full rounded-lg border border-border"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
