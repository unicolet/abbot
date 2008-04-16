require 'sproutcore/jsdoc'

module SproutCore
  module Merb
   
    # A subclass of this controller handles all incoming requests for the location it is
    # mounted at.  For index.html requests, it will rebuild the html file everytime it is
    # requested if you are in development mode.  For all other requests, it will build the
    # resource one time and then return the file if it already exists.
    class BundleController < ::Merb::Controller
      
      def self.library_for_class(klass)
        (@registered_libraries ||= {})[klass]
      end
      
      def self.register_library_for_class(library, klass)
        (@registered_libraries ||= {})[klass] = library
      end
        
      # Entry point for all requests routed through the SproutCore controller.  Example
      # the request path to determine which bundle should handle the request.
      def main

        # Before we do anything, set the build_mode for the bundles.  This shouldn't change
        # during execution, but if we set this during the router call, the Merb.environment
        # is sometimes not ready yet.
        if ::Merb.environment.to_sym == :production
          Bundle.build_mode = :production
        else
          ::SproutCore.logger.level = Logger::DEBUG
        end
        
        # Make sure we can service this with a bundle
        raise(NotFound, "No SproutCore Bundle registered at this location.") if current_bundle.nil?

        # Check for a few special urls that need to be rewritten
        url = request.path
        if request.method == :get 
          url = rewrite_bundle_if(url, /^#{current_bundle.index_root}\/-tests/, :sc_test_runner)
          url = rewrite_bundle_if(url, /^#{current_bundle.index_root}\/-docs/, :sc_docs)
        end

        # If we are in development mode, reload bundle first
        library.reload_bundles! if current_bundle.build_mode == :development

        # Get the normalized URL for the requested resource
        url = current_bundle.normalize_url(url)

        # Check for a few special urls for built-in services and route them off
        case url
        when "#{current_bundle.url_root}/-tests/index.js"
          ret = handle_test(url)
        when "#{current_bundle.index_root}/-docs/index.html"
          ret = (request.method == :post) ? handle_doc(url) : handle_resource(url)

        when "#{current_bundle.url_root}/-docs/index.html"
          ret = (request.method == :post) ? handle_doc(url) : handle_resource(url)

        else
          ret = handle_resource(url)
        end
        
        # Done!
        return ret
      end
      
      # Invoked whenever you request a regular resource
      def handle_resource(url)
        
        # Get the entry for the resource.  
        entry = current_bundle.entry_for_url(url, :hidden => :include)
        raise(NotFound, "No matching entry in #{current_bundle.bundle_name}") if entry.nil?

        
        build_path = entry.build_path

        # Found an entry, build the resource.  If the resource has already been built, this
        # will not do much.  If this the resource is an index.html file, force the build.
        is_index = /\/index\.html$/ =~ url
        
        current_bundle.build_entry(entry, :force => is_index, :hidden => :include)

        # Move to final build path if necessary
        if (build_path != entry.build_path) && File.exists?(entry.build_path)
          FileUtils.mv(entry.build_path, build_path)
        end

        # And return the file.  Set the content type using a mime-map borroed from Rack.
        headers['Content-Type'] = entry.content_type
        headers['Content-Length'] = File.size(build_path).to_s
        ret = File.open(build_path)
        
        
        # In development mode only, immediately delete built composite resources.  We want 
        # each request to come directly to us.
        if (current_bundle.build_mode == :development) && (!entry.cacheable?)
          FileUtils.rm(build_path)
        end
        
        return ret
      end

      # Returns JSON containing all of the tests
      def handle_test(url)
        test_entries = current_bundle.entries_for(:test, :hidden => :include)
        content_type = :json
        ret = test_entries.map do |entry| 
          { :name => entry.filename.gsub(/^tests\//,''), :url => "#{entry.url}?#{entry.timestamp}" }
        end
        return ret.to_json
      end

      # If you POST to this URL, regenerates the docs.
      def handle_doc(url)
        JSDoc.generate :bundle => current_bundle
        return "OK"
      end
      
      ######################################################################
      ## Support Methods
      ##
      
      # Returns the library for this class
      def library
        ::SproutCore::Merb::BundleController.library_for_class(self.class)
      end
      
      
      # Returns the bundle for this request
      def current_bundle
        return @current_bundle unless @current_bundle.nil?

        # Tear down the URL, looking for the first bundle 
        bundle_map = library.bundles_grouped_by_url
        url = request.path.split('/')
        ret = nil
        while url.size > 0 && ret.nil?
          ret = bundle_map[url.join('/')]
          url.pop
        end
        
        # Try root path if nothing found
        ret = bundle_map['/'] if ret.nil?
        
        # Return
        return (@current_bundle = ret)
      end

      # This method is used to redirect certain urls to an alternate bundle.  If the 
      # match phrase matches the url, then both the url we use to fetch resources and the
      # current_bundle will be swapped out.
      #
      # ===== Params
      # url<String>:: The url to check
      # match<Regex>:: The pattern to match and optionally later replace
      # new_bundle_name<Symbol>:: The name of the new bundle to swap in if matched
      #
      # ===== Returns
      # The rewritten url.  May also change the value of current_bundle
      #
      def rewrite_bundle_if(url, match, new_bundle_name)
        return url unless match =~ url
        new_bundle = library.bundle_for(new_bundle_name)
        if new_bundle
          url = url.gsub(match, new_bundle.index_root)
          @current_bundle = new_bundle
        end
        return url
      end
      
    end
    
  end
end