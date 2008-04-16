// ==========================================================================
// SC.GridView
// ==========================================================================

require('views/collection') ;
require('views/label');

/** @class

  A grid view renders a collection of items in a grid of rows and columns.

  @extends SC.CollectionView
  @author    Charles Jolley  
  @version 1.0
*/
SC.GridView = SC.CollectionView.extend(
/** @scope SC.GridView.prototype */ {
  
  emptyElement: '<div class="grid-view"></div>',
  
  /** 
    The common row height for grid items.
    
    The value should be an integer expressed in pixels.
  */
  rowHeight: 48,
  
  /**
    The minimum column width for grid items.  Items will actually
    be laid out as needed to completely fill the space, but the minimum
    width of each item will be this value.
  */
  columnWidth: 64,
  
  /**
    The default example item view will render text-based items.
    
    You can override this as you wish.
  */
  exampleView: SC.LabelView,
  
  insertionOrientation: SC.HORIZONTAL_ORIENTATION,

  // computed function for keyboard handling.
  itemsPerRow: function() {
    var ret = this._computeItemsPerRow() ;
    console.log('ret = %@'.fmt(ret)) ;
    return ret ;
  }.property(),
  
  /** 
    Calculates the number of items per row.
  */
  _computeItemsPerRow: function() {
    var f = this.get('innerFrame') ;
    var columnWidth = this.get('columnWidth') || 0 ;
    return (columnWidth <= 0) ? 1 : Math.floor(f.width / columnWidth) ;
  },

  /** @private
    Find the contentRange to display in the passed frame.  Note that we 
    ignore the width of the frame passed since we need to have a single
    contiguous range.
  */
  contentRangeInFrame: function(frame) {
    var rowHeight = this.get('rowHeight') || 48 ;
    var itemsPerRow = this._computeItemsPerRow() ;

    var min = Math.floor(SC.minY(frame) / rowHeight) * itemsPerRow  ;
    var max = Math.ceil(SC.maxY(frame) / rowHeight) * itemsPerRow ;
    var ret = { start: min, length: max - min } ; 
    //console.log('contentRangeInFrame(%@) = %@'.fmt($H(frame).inspect(), $H(ret).inspect()));
    //if (frame.height < 100) debugger ;
    return ret ;
  },

  layoutItemView: function(itemView, contentIndex, firstLayout) {
    if (!itemView) debugger ;
    SC.Benchmark.start('SC.GridView.layoutItemViewsFor') ;

    var rowHeight = this.get('rowHeight') || 0 ;
    var parentView = itemView.get('parentView') ;
    var frameWidth = this.get('innerFrame').width ;
    var itemsPerRow = this._computeItemsPerRow() ;
    var columnWidth = Math.floor(frameWidth/itemsPerRow);
    
    var row = Math.floor(contentIndex / itemsPerRow) ;
    var col = contentIndex - (itemsPerRow*row) ;
    var f = { 
      x: col * columnWidth, y: row * rowHeight,
      height: rowHeight, width: columnWidth
    };

    if (firstLayout || !SC.rectsEqual(itemView.get('frame'), f)) {
      itemView.set('frame', f) ;      
    }
    SC.Benchmark.end('SC.GridView.layoutItemViewsFor') ;
  },

  computeFrame: function() {
    var content = this.get('content') ;
    var rows = (content) ? content.get('length') : 0 ;
    var rowHeight = this.get('rowHeight') || 20 ;

    var parent = this.get('parentNode') ;
    var f = (parent) ? parent.get('innerFrame') : { width: 100, height: 100 } ;

    f.x = f.y = 0;
    f.height = Math.max(f.height, rows * rowHeight) ;
//    console.log('computeFrame(%@)'.fmt($H(f).inspect())) ;
    return f ;
  },
  
    
  /** @private */
  layoutItemViewsFor: function(parentView, startingView) {
    SC.Benchmark.start('SC.GridView.layoutItemViewsFor') ;

    var rowHeight = this.get('rowHeight') ;
    var columnWidth = this.get('columnWidth') ;
    if ((rowHeight == null) || (columnWidth == null)) return false ;

    // set items per row.
    parentView = parentView || this ;
    var f = parentView.get('innerFrame') ;
    f.x= f.y = 0 ; 
    var itemsPerRow = Math.floor(f.width / (columnWidth || 1)) ;
    if (this.get('itemsPerRow') != itemsPerRow) this.set('itemsPerRow', itemsPerRow);
    
    // fix width to evenly match items per row
    columnWidth = Math.floor((f.width-20)/itemsPerRow) ;
    
    // get the startingView and the starting row, col
    var view = startingView || parentView.firstChild;
    var content = this.get('content') || [] ;
    var idx = (view) ? content.indexOf(view.get('content')) : 0;

    
    f = { x: 0, y: 0, height: rowHeight, width: columnWidth } ;
    
    while(view) {

      // calculate position.
      var row = Math.floor(idx / itemsPerRow) ;
      var col = idx - (row * itemsPerRow) ;
      f.x = col * columnWidth;  f.y = row * rowHeight ;

      if (!SC.rectsEqual(view.get('frame'), f)) view.set('frame', f) ;
      
      // go to next one
      view = view.nextSibling ;
      idx++ ;
    }
    
    SC.Benchmark.end('SC.GridView.layoutItemViewsFor') ;
    
    return true; 
  },
  
  computeFrame: function() {
    var content = this.get('content') ;
    var count = (content) ? content.get('length') : 0 ;
    var rowHeight = this.get('rowHeight') || 0 ;
    var columnWidth = this.get('columnWidth') || 0 ;

    var parent = this.get('parentNode') ;
    var f = (parent) ? parent.get('innerFrame') : { width: 0, height: 0 };
    var itemsPerRow = (columnWidth <= 0) ? 1 : (f.width / columnWidth) ;
    var rows = Math.ceil(count / itemsPerRow) ;

    f.x = f.y = 0;
    f.height = Math.max(f.height, rows * rowHeight) ;
    
    return f ;
  },
  
  
  insertionPointClass: SC.View.extend({
    emptyElement: '<div class="grid-insertion-point"><span class="anchor"></span></div>'
  }),
  
  showInsertionPointBefore: function(itemView) {
    
    if (!itemView) return ;
  
    if (!this._insertionPointView) {
      this._insertionPointView = this.insertionPointClass.create() ;
    } ;
    
    var insertionPoint = this._insertionPointView ;
    var itemViewFrame = itemView.get('frame') ;
    f = { height: itemViewFrame.height - 6, 
          x: itemViewFrame.x, 
          y: itemViewFrame.y + 6, 
          width: 0 
        };
        
    console.log('showInsertionPointBefore(%@) f=%@'.fmt(itemView,$H(f).inspect())) ;
    
    if (!SC.rectsEqual(insertionPoint.get('frame'), f)) {
      insertionPoint.set('frame', f) ;
    }
  
    if (insertionPoint.parentNode != itemView.parentNode) {
      itemView.parentNode.appendChild(insertionPoint) ;
    }
  },
  
  hideInsertionPoint: function() {
    var insertionPoint = this._insertionPointView ;
    if (insertionPoint) insertionPoint.removeFromParent() ;
  },
  
  // // We can do this much faster programatically using the rowHeight
  insertionIndexForLocation: function(loc) {  
    var f = this.get('frame') ;
    var sf = this.get('scrollFrame') ;
    
    var itemsPerRow = this._computeItemsPerRow(); 
    var columnWidth = Math.floor(f.width / itemsPerRow) ;
    var row = Math.floor((loc.y - f.y - sf.y) / this.get('rowHeight')) ;
    var col = Math.floor(((loc.x - f.x - sf.x) / columnWidth) + 0.5) ;
    
    var ret= (row*itemsPerRow) + col ;
    //console.log("insertionIndexForLocation = %@".fmt(ret)) ;
    return ret ;
  }
  
}) ;
